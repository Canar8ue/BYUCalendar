import {database} from '../db';
import seed from '../data/seed.json';
import {SOURCES,UNCONNECTED,parseICS,enrichBYU,mergeEvents,lastDay} from './catalog.mjs';
import type {CampusEvent,CalendarData} from '../app/types';
type Snapshot={id:string;payload:string;last_success:string;last_attempt:string|null;error:string|null;lock_until:number};

async function ensureSeed(){const db=database();const found=await db.prepare('SELECT id FROM source_snapshots LIMIT 1').first();if(!found)await db.batch(seed.map(s=>db.prepare('INSERT INTO source_snapshots (id,payload,last_success,lock_until) VALUES (?,?,?,0) ON CONFLICT(id) DO NOTHING').bind(s.id,JSON.stringify(s.events),s.lastSuccess)));return db;}
export async function readCalendar():Promise<CalendarData>{
 const db=await ensureSeed();const rows=(await db.prepare('SELECT * FROM source_snapshots').all<Snapshot>()).results;
 const all:CampusEvent[]=[];const statuses=SOURCES.map(source=>{const row=rows.find(r=>r.id===source.id);const events=row?JSON.parse(row.payload):[];all.push(...events);return {id:source.id,name:source.name,url:source.url,count:events.filter((e:CampusEvent)=>!e.cancelled&&lastDay(e)>=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver'}).format(new Date())).length,lastSuccess:row?.last_success||null,error:row?.error||null,enabled:true,note:source.id==='marriott-bsisys'||source.id==='marriott-mism'?'The public feed currently has no upcoming events. Private program announcements are not included.':undefined};});
 return {events:mergeEvents(all) as CampusEvent[],sources:[...statuses,...UNCONNECTED.map(s=>({...s,enabled:false,count:0,lastSuccess:null,error:null}))],stored:true};
}
async function remote(url:string){const response=await fetch(url,{headers:{Accept:'text/calendar, application/json;q=0.9, */*;q=0.5'},signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error(`Source returned HTTP ${response.status}`);const value=await response.text();if(value.length>8_000_000)throw new Error('Source feed is too large to import safely.');return value;}
export async function refreshCalendar(force=false){
 const db=await ensureSeed();const rows=(await db.prepare('SELECT * FROM source_snapshots').all<Snapshot>()).results;const now=Date.now();let refreshed=0;
 for(const source of SOURCES){const row=rows.find(r=>r.id===source.id);const checked=Date.parse(row?.last_attempt||row?.last_success||'1970-01-01');const interval=force?300000:row?.error?900000:3600000;if(now-checked<interval)continue;
   const lease=Date.now()+120000;const acquired=await db.prepare('UPDATE source_snapshots SET lock_until=?,last_attempt=? WHERE id=? AND lock_until<? RETURNING id').bind(lease,new Date().toISOString(),source.id,Date.now()).first();if(!acquired)continue;
   try{const raw=await remote(source.feed);let events=parseICS(raw,source);
     if(source.id==='byu'){
       // Calendar feed is the authoritative inventory. Rich metadata enriches it but never removes entries.
       const details:Record<string,unknown>[]=[];let metadataError=false;
       for(let page=0;page<4;page++){try{const url=new URL('https://calendar.byu.edu/api/Events.json');url.searchParams.set('categories','all');url.searchParams.set('event[min][date]',new Date().toISOString().slice(0,10));const end=new Date();end.setFullYear(end.getFullYear()+1);url.searchParams.set('event[max][date]',end.toISOString().slice(0,10));url.searchParams.set('limit','500');url.searchParams.set('offset',String(page*500));const data=JSON.parse(await remote(url.href));if(!Array.isArray(data))throw new Error('Unexpected event metadata');details.push(...data);if(data.length<500)break;}catch{metadataError=true;break;}}
       events=enrichBYU(events,details);
       // Preserve last verified enrichment if its source record has not changed during a metadata outage.
       if(metadataError&&row){const old=new Map((JSON.parse(row.payload) as CampusEvent[]).map(e=>[e.id,e]));events=events.map(e=>{const prior=old.get(e.id);return prior&&e.sourceUpdated===prior.sourceUpdated?{...prior,start:e.start,end:e.end,cancelled:e.cancelled}:e;});}
       await db.prepare('UPDATE source_snapshots SET payload=?,last_success=?,error=?,lock_until=0 WHERE id=? AND lock_until=?').bind(JSON.stringify(events),new Date().toISOString(),metadataError?'Listings refreshed; some detailed descriptions could not be refreshed.':null,source.id,lease).run();
     }else await db.prepare('UPDATE source_snapshots SET payload=?,last_success=?,error=NULL,lock_until=0 WHERE id=? AND lock_until=?').bind(JSON.stringify(events),new Date().toISOString(),source.id,lease).run();
     refreshed++;
   }catch(error){console.error('Calendar source refresh failed',source.id,error);await db.prepare('UPDATE source_snapshots SET error=?,lock_until=0 WHERE id=? AND lock_until=?').bind('Could not refresh this source. Previously collected events are still available.',source.id,lease).run();}
 }
 return {refreshed};
}
