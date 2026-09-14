import {load} from 'cheerio/slim';
import {parseICS,clean,classify,enrichBYU} from './catalog.mjs';

// Website adapters stay server-side. Follow only event links on the configured site.
export function sameSite(value,base){
  try{const u=new URL(value,base);return u.protocol==='https:'&&u.origin===new URL(base).origin&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function listingLinks(html,source){
  const $=load(html),links=new Set();
  const modules=$('.ListUpcomingEvents, .ListAthleticEvent, .SearchResultsModule, .SearchResults, .SearchSnippet, .ListCalendar, .ListEvent');
  $('table.ListUpcomingEvents-table a[href], [class*="Promo"][class*="Event-title"] a[href], .SearchSnippet [class*="-title"] a[href]').each((_,el)=>{
    const href=sameSite($(el).attr('href'),source.url);if(href)links.add(href);
  });
  // ACME also places upcoming events in dated links on its home page.
  if(source.id==='acme')$('main a[href]').each((_,el)=>{const href=sameSite($(el).attr('href'),source.url);if(href&&new URL(href).pathname.startsWith('/event/'))links.add(href);});
  if(!modules.length&&!links.size)throw new Error('The event listing format changed.');
  const next=$('a[rel="next"], .Pagination-next a, a.Pagination-next, .SearchResultsModule-nextPage a, a.SearchResultsModule-nextPage').first().attr('href');
  return {links:[...links],next:next?sameSite(next,source.url):null};
}
export function eventPage(html,url){
  const $=load(html);
  const feed=$('a[href]').toArray().map(el=>sameSite($(el).attr('href'),url)).find(href=>href&&new URL(href).pathname==='/_event.ics');
  if(!feed)throw new Error('Event has no calendar download.');
  const body=$('.EventPage-eventBody, .EventPage-articleBody').first();
  body.find('script,style').remove();
  return {feed,description:clean(body.html()||'')};
}
export async function remoteText(url,signal){
  const response=await fetch(url,{headers:{Accept:'text/calendar, application/json;q=0.9, text/html;q=0.8'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000)});
  if(!response.ok)throw new Error(`Source returned HTTP ${response.status}`);
  if(Number(response.headers.get('content-length'))>8_000_000)throw new Error('Source is too large.');
  const reader=response.body?.getReader();if(!reader)throw new Error('Source returned no content.');
  const decoder=new TextDecoder();let bytes=0,value='';
  while(true){const {done,value:chunk}=await reader.read();if(done)break;bytes+=chunk.length;if(bytes>8_000_000){await reader.cancel();throw new Error('Source is too large.');}value+=decoder.decode(chunk,{stream:true});}
  return value+decoder.decode();
}
async function metadata(source,read,now){
  const base=source.metadata||(source.id==='byu'?'https://calendar.byu.edu/api/Events.json':null);if(!base)return [];
  const min=new Date(now);min.setDate(min.getDate()-45);const max=new Date(now);max.setFullYear(max.getFullYear()+1);const details=[];
  for(let page=0;page<8;page++){
    const url=new URL(base);url.search=new URLSearchParams({categories:'all','event[min][date]':min.toISOString().slice(0,10),'event[max][date]':max.toISOString().slice(0,10),limit:'500',offset:String(page*500)}).toString();
    const data=JSON.parse(await read(url.href));if(!Array.isArray(data))throw new Error('Unexpected event metadata.');
    details.push(...data);if(data.length<500)return details;
  }
  throw new Error('Metadata exceeded the page limit.');
}
function validateDurations(events){
  return events.map(e=>!e.allDay&&e.end&&Date.parse(e.end)-Date.parse(e.start)>31*86400000?{...e,end:null,description:e.description+'\n\nThe source lists an unusually long duration. End time needs confirmation; check the original event.'}:e);
}
export async function importSource(source,{now=new Date(),previous=[],read}={}){
  const deadline=AbortSignal.timeout(90000);read||=(url=>remoteText(url,deadline));
  if(source.kind!=='brightspot-pages'){
    let events=parseICS(await read(source.feed),source,now),warning=null;
    if(source.ownHost)events=events.filter(e=>new URL(e.url).origin===new URL(source.url).origin);
    if(source.metadata||source.id==='byu'){
      try{events=enrichBYU(events,await metadata(source,read,now));}
      catch{warning='Calendar updated; detailed descriptions could not be refreshed.';const old=new Map(previous.map(e=>[e.id,e]));events=events.map(e=>{const prior=old.get(e.id);return prior&&prior.sourceUpdated===e.sourceUpdated?classify({...e,description:prior.description,location:prior.location}):e;});}
    }
    return {events:validateDurations(events),warning};
  }
  const links=new Set(),pages=new Set();let next=source.url;
  while(next){
    if(pages.has(next)||pages.size>=8)throw new Error('Event pagination could not be completed.');pages.add(next);
    const listing=listingLinks(await read(next),source);listing.links.forEach(link=>links.add(link));next=listing.next;
    if(links.size>120)throw new Error('Event listing exceeded the import limit.');
  }
  const queue=[...links],events=[],failed=[];
  // A few concurrent detail downloads keep page sources responsive without flooding a site.
  await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{
    while(queue.length){const url=queue.shift();try{
      const detail=eventPage(await read(url),url);
      const records=parseICS(await read(detail.feed),source,now);
      events.push(...records.map(e=>classify({...e,url,description:detail.description||e.description})));
    }catch{failed.push(url);}}
  }));
  if(failed.length===links.size&&links.size)throw new Error('Event details could not be imported.');
  // An isolated failed page must not erase its previous verified events.
  events.push(...previous.filter(e=>failed.includes(e.url)));
  return {events:validateDurations([...new Map(events.map(e=>[e.id,e])).values()]),warning:failed.length?`${failed.length} event pages could not refresh. Previous details are retained.`:null};
}
