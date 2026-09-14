import ICAL from 'ical.js';

export const SOURCES = [
  {id:'byu',name:'BYU Events',url:'https://calendar.byu.edu',feed:'https://calendar.byu.edu/iCal/export/all',category:'Campus life'},
  ...[['cet','Entrepreneurship','Career & business'],['mba','MBA','Career & business'],['emba','Executive MBA','Career & business'],['events','Marriott featured','Academic'],['calendar','Marriott School','Career & business'],['esr','Ballard Center','Career & business'],['gmc','Global Business','Career & business'],['bsisys','Information Systems','Career & business'],['mism','MISM','Career & business']].map(([id,name,category])=>({id:'marriott-'+id,name,url:'https://marriott.byu.edu/calendar/',feed:`https://calendar.google.com/calendar/ical/${id}%40marriottschool.net/public/basic.ics`,category})),
  {id:'ais',name:'AIS',url:'https://byu-ais.byu.edu/activities',feed:'https://calendar.google.com/calendar/ical/ais.byu%40gmail.com/public/basic.ics',category:'Career & business',tags:['IS','AIS','Clubs'],note:'Public AIS calendar. Some event details are only announced in Slack.'},
  {id:'accounting-society',name:'Accounting Society',url:'https://accountingsociety.byu.edu/',kind:'brightspot-pages',category:'Career & business',tags:['Accounting','Clubs']},
  {id:'engineering',name:'Engineering',url:'https://engineering.byu.edu/calendar',feed:'https://engineering.byu.edu/iCal/export/all',metadata:'https://engineering.byu.edu/api/Events.json',ownHost:true,category:'Academic',tags:['Engineering']},
  {id:'math',name:'Mathematics',url:'https://math.byu.edu/calendar',feed:'https://math.byu.edu/iCal/export/all',metadata:'https://math.byu.edu/api/Events.json',ownHost:true,category:'Academic',tags:['Math']},
  {id:'cs',name:'Computer Science',url:'https://cs.byu.edu/department/event-calendar',kind:'brightspot-pages',category:'Academic',tags:['Computer Science']},
  {id:'acme',name:'ACME',url:'https://acme.byu.edu/',kind:'brightspot-pages',category:'Academic',tags:['Math','ACME']},
  {id:'life-sciences',name:'Life Sciences',url:'https://lifesciences.byu.edu/month',feed:'https://lifesciences.byu.edu/iCal/export/all',metadata:'https://lifesciences.byu.edu/api/Events.json',ownHost:true,category:'Academic',tags:['Life Sciences']},
  {id:'kennedy',name:'Kennedy Center',url:'https://kennedy.byu.edu/events',kind:'brightspot-pages',category:'Academic',tags:['International']},
  {id:'law',name:'BYU Law',url:'https://law.byu.edu/',feed:'https://25livepub.collegenet.com/calendars/homepagecalendar.ics',category:'Academic',tags:['Law'],note:'Public law school calendar. Check each event for attendance requirements.'},
  {id:'marketing',name:'Marketing Association',url:'https://ma.byu.edu/calendar',feed:'https://calendar.google.com/calendar/ical/9q9n2s6t2s01mvjqc12qeqhil8%40group.calendar.google.com/public/basic.ics',category:'Career & business',tags:['Marketing','Clubs'],note:'Public association calendar; currently no upcoming events published.'},
  {id:'club-directory',name:'BYU Student Organizations',url:'https://clubs.byu.edu/',kind:'snapshot',category:'Campus life',tags:['Clubs'],note:'Snapshot collected September 14, 2026. Automatic updates need a published feed; confirm changes with the club.'},
];
export const INTEREST_TAGS=['IS','AIS','Accounting','Finance','Marketing','Engineering','Computer Science','Math','ACME','Life Sciences','International','Law','Clubs','Networking','Workshops','Recruiting','Entrepreneurship'];
export const CATEGORIES=[{id:'Campus life',color:'blue'},{id:'Career & business',color:'green'},{id:'Arts & culture',color:'purple'},{id:'Sports & recreation',color:'orange'},{id:'Faith & learning',color:'teal'},{id:'Academic',color:'slate'}];
export const UNCONNECTED=[
 {id:'handshake',name:'Handshake',url:'https://handshake.byu.edu',note:'A school calendar export from BYU Career Services is needed.'},
 {id:'slack',name:'AIS · Slack',url:'https://marriott.byu.edu/infosys/get-involved/student-organizations/ais/',note:'An AIS workspace app or an organizer-provided calendar feed is needed.'},
 {id:'social',name:'Instagram & Facebook',url:'https://www.instagram.com',note:'Club account connections are needed. Social posts are not being imported.'}
 ,{id:'bap',name:'Beta Alpha Psi',url:'https://marriott.byu.edu/clubs/directory/',note:'Listed in the club directory, but the linked club website is unavailable. A current calendar is needed.'}
];
export function clean(value=''){return String(value==null||value==='null'||value==='undefined'?'':value).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<br\s*\/?>|<\/p>|<\/div>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:39|x27);|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();}
export function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function civilToISO(value,zone='America/Denver'){
  const parts=String(value).match(/\d+/g);if(!parts||parts.length<3)return null;
  const [y,m,d,h=0,min=0,s=0]=parts.map(Number);const target=Date.UTC(y,m-1,d,h,min,s);let instant=target;
  try{for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]));const shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);const delta=target-shown;instant+=delta;if(!delta)break;}}catch{return null;}return new Date(instant).toISOString();
}
function timeISO(t,defaultZone='America/Denver'){
  if(!t)return null;if(t.isDate)return t.toString().slice(0,10);
  if(t.zone?.tzid==='UTC')return t.toJSDate().toISOString();
  return civilToISO(t.toString(),t.zone?.tzid&&t.zone.tzid!=='floating'?t.zone.tzid:defaultZone);
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
export function classify(event,meta={}){
  const t=clean(event.title),d=clean(event.description);const text=`${t} ${d}`.toLowerCase();const hints=`${meta.CategoryName||''} ${meta.DeptNames||''} ${meta.TagsNames||''} ${event.url}`.toLowerCase();
  let category=event.category||'Campus life';
  if(/academiccalendar|academic calendar|tuition|withdraw|semester|add.drop|grades due|final exam/.test(hints+' '+t.toLowerCase()))category='Academic';
  else if(/athletics|sport|volleyball|basketball|football|soccer|rugby|cross country|swim|softball|baseball/.test(hints+' '+t.toLowerCase()))category='Sports & recreation';
  else if(/arts.entertainment|onstage|music|theatre|theater|concert|film|dance|museum|exhibition/.test(hints+' '+t.toLowerCase()))category='Arts & culture';
  else if(/devotional|forum|religious|scripture|wheatley/.test(hints+' '+t.toLowerCase()))category='Faith & learning';
  else if(/career|recruit|network|entrepreneur|business|internship|professional|marriott|mba/.test(hints+' '+t.toLowerCase()))category='Career & business';
  const tags=new Set(event.sourceTags||SOURCES.find(s=>s.id===event.sourceId)?.tags||[]);
  if(/\baccounting\b|beta alpha psi|\baccountancy\b/.test(text))tags.add('Accounting');
  if(/\bmarketing\b/.test(text))tags.add('Marketing');
  if(/\bfinance\b|investment banking/.test(text))tags.add('Finance');
  if(/\bengineering\b/.test(text))tags.add('Engineering');
  if(/computer science|cyber ?(?:security|defense)|\bprogramming\b/.test(text))tags.add('Computer Science');
  if(/\bacme\b|\bsnacme\b/.test(text)){tags.add('ACME');tags.add('Math');}
  if(/\binformation systems\b|\bis department\b|\bis major|\bmism\b/.test(text)||/bsisys|mism/.test(event.sourceId))tags.add('IS');
  if(/\bais\b|association for information systems/.test(text))tags.add('AIS');
  if(/\bclub|student organization/.test(text))tags.add('Clubs');
  if(/network|meet.*professional/.test(text))tags.add('Networking');
  if(/workshop|hands.on|training/.test(text))tags.add('Workshops');
  if(/career fair|recruit|internship|employer/.test(text))tags.add('Recruiting');
  if(/entrepreneur|startup|start.up|pitch|big idea/.test(text)||event.sourceId==='marriott-cet')tags.add('Entrepreneurship');
  let food=/(?:(?:free|complimentary)\s+(?:pizza|food|lunch|dinner|breakfast|meal|tacos|pancakes)|(?:pizza|food|lunch|dinner|breakfast|meal|tacos)\s+(?:will be\s+)?(?:provided|served)|enjoy.{0,40}(?:food|pizza)|food\s+provided)/i.test(text)?'yes':/\bno food\b/.test(text)?'no':null;
  let snacks=/(?:snacks|cookies|refreshments)\s+(?:will be\s+)?(?:provided|served)|(?:free|complimentary)\s+(?:snacks|cookies|refreshments)/.test(text)?'yes':null;
  let drinks=/(?:drinks|soda|beverages)\s+(?:will be\s+)?(?:provided|served)|(?:free|complimentary)\s+(?:drinks|soda|beverages)|pizza and soda/.test(text)?'yes':null;
  const plain=text.replace(/[^\p{L}\p{N}\s'-]/gu,' ').replace(/\s+/g,' ');
  if(/(?:pizza|pita pit|chick-fil-a(?: nuggets)?|food|lunch|dinner|breakfast|meal|tacos)\s+(?:(?:will be|is|are)\s+)?(?:provided|served)/.test(plain))food='yes';
  if(/(?:pizza|food|lunch|dinner|meal)\s+and\s+(?:drinks|snacks|refreshments)\s+(?:(?:will be|are)\s+)?(?:provided|served)/.test(plain))food='yes';
  if(/(?:enjoy|eat|grab|pick up).{0,30}\b(?:pie|pizza|lunch|dinner|tacos)\b/.test(plain))food='yes';
  if(/(?:pick up|enjoy|grab|come for).{0,50}\b(?:snacks|refreshments)\b/.test(plain))snacks='yes';
  if(/(?:enjoy|served|provided).{0,40}\bmilk\b|\bmilk\b.{0,25}(?:served|provided)/.test(plain))drinks='yes';
  if(/(?:no|without)\s+(?:free\s+)?(?:food|meals?|pizza)|(?:food|meals?)\s+(?:(?:is|will be)\s+)?not\s+(?:provided|served|available)/.test(text))food='no';if(/(?:no|without)\s+(?:free\s+)?(?:snacks|refreshments)|(?:snacks|refreshments)\s+(?:(?:are|will be)\s+)?not\s+(?:provided|served|available)/.test(text))snacks='no';if(/(?:no|without)\s+(?:free\s+)?(?:drinks|beverages)|(?:drinks|beverages)\s+(?:(?:are|will be)\s+)?not\s+(?:provided|served|available)/.test(text))drinks='no';
  let free=meta.IsFree==='true'?true:meta.IsFree==='false'?false:null;
  // Do not confuse free food with free admission, nor placeholder $0 ticket records with free events.
  if(meta.TicketsExist?.trim()==='Yes'&&!/free\b|no charge|complimentary admission/.test(text))free=null;
  if(/free admission|free event|no charge|admission is free|\nfree(?:\n|\s*\()/.test(text))free=true;
  if(/(?:\$\d+(?:\.\d+)?\s*\)?\s*(?:is\s+)?required|(?:assessment|admission|ticket).{0,25}\$\d+.{0,20}required)/.test(text))free=false;
  const audience=/members.only|members only/.test(text)?'Members only':/all byu students|all students/.test(text)?'BYU students':/open to (?:the public|everyone|all)|everyone (?:is )?welcome|all are welcome/.test(text)?'Open invite':null;
  const location=clean(event.location);const virtual=/zoom|virtual|online|webinar/.test(location.toLowerCase());const physical=!!location&&!virtual&&!/^tbd|tba|to be|various|see /i.test(location);
  const streaming=/broadcast live|livestream|live.stream|streamed|join.{0,20}(?:zoom|online)/.test(text);
  const format=physical?(streaming?'Hybrid':'In person'):virtual?'Online':null;
  if(food!=='no'&&snacks!=='no'&&/(?:free|complimentary)\s+(?:pizza|food|lunch|dinner|breakfast|meal|snacks|cookies|refreshments)/.test(text))tags.add('Free food');if(food==='yes'||snacks==='yes')tags.add('Food provided');if(snacks==='yes')tags.add('Snacks');if(drinks==='yes')tags.add('Drinks');if(free===true)tags.add('Free admission');if(audience==='Open invite'||audience==='BYU students')tags.add('Open invite');if(format==='In person'||format==='Hybrid')tags.add('In person');if(format==='Online'||format==='Hybrid')tags.add('Online');if(/rsvp|register|registration|tickets required/.test(text)||meta.TicketsExist?.trim()==='Yes')tags.add('RSVP / tickets');
  return {...event,title:t,description:d,location,category,tags:[...tags],food,snacks,drinks,free,audience,format};
}
export function parseICS(raw,source,now=new Date()){
  if(!raw.includes('BEGIN:VCALENDAR'))throw new Error('Source did not return a calendar.');
  const root=new ICAL.Component(ICAL.parse(raw));for(const tz of root.getAllSubcomponents('vtimezone')){const id=tz.getFirstPropertyValue('tzid');if(id)ICAL.TimezoneService.register(new ICAL.Timezone({component:tz,tzid:id}));}
  const min=new Date(now);min.setDate(min.getDate()-45);const max=new Date(now);max.setFullYear(max.getFullYear()+1);
  const comps=root.getAllSubcomponents('vevent');const exceptions=new Map();for(const c of comps){if(c.getFirstPropertyValue('recurrence-id')){const uid=c.getFirstPropertyValue('uid');if(!exceptions.has(uid))exceptions.set(uid,[]);exceptions.get(uid).push(c);}}
  const records=[];
  for(const c of comps){if(c.getFirstPropertyValue('recurrence-id'))continue;const e=new ICAL.Event(c,{exceptions:[]});if(!e.startDate)continue;for(const ex of exceptions.get(e.uid)||[])try{e.relateException(new ICAL.Event(ex,{exceptions:[]}));}catch{}
    const add=(item,start,end,occurrence)=>{const begins=timeISO(start,root.getFirstPropertyValue('x-wr-timezone')||'America/Denver');if(!begins||new Date(begins)>max)return;let ends=timeISO(end);if(!ends||ends<=begins)ends=null;if(new Date(ends||begins)<min)return;
      const url=safeUrl(item.component.getFirstPropertyValue('url'))||source.url;
      const title=clean(item.summary||'Untitled event');
      records.push(classify({id:`${source.id}-${hash(String(e.uid)+(e.isRecurring()?'|'+occurrence:''))}`,title,description:clean(item.description),start:begins,end:ends,allDay:start.isDate,location:clean(item.location),url,sourceId:source.id,sourceName:source.name,category:source.category,cancelled:String(item.component.getFirstPropertyValue('status')).toUpperCase()==='CANCELLED',sourceUpdated:timeISO(item.component.getFirstPropertyValue('last-modified'))}));};
    if(e.isRecurring()){const iter=e.iterator();let n=0,next;while((next=iter.next())&&n++<30000){if(next.toString().slice(0,10)>max.toISOString().slice(0,10))break;if(next.toString().slice(0,10)<min.toISOString().slice(0,10))continue;const detail=e.getOccurrenceDetails(next);add(detail.item,detail.startDate,detail.endDate,next.toString());}if(n>=30000)throw new Error('Recurring source exceeded safe expansion limit.');}
    else add(e,e.startDate,e.endDate,e.startDate.toString());
  }
  return records;
}
export function enrichBYU(events,details){const byUrl=new Map(details.map(d=>[d.FullUrl,d]));return events.map(e=>{const m=byUrl.get(e.url);if(!m)return e;return classify({...e,description:clean(m.Description||m.ShortDescription||e.description),location:clean(m.LocationName||e.location)},m);});}
export function mergeEvents(events){
  const grouped=new Map();
  for(const e of events){
    const title=e.title.toLowerCase().replace(/^byu\s+/,'').replace(/[^a-z0-9]/g,'');
    // Generic club titles are not sufficient evidence that different organizations share an event.
    const generic=/^(?:opening|closing)social$|^weeklymeeting$|^clubmeeting$/.test(title);
    const key=title+'|'+e.start+(generic?'|'+(e.organization||e.sourceId):'');
    const previous=grouped.get(key);
    if(!previous){grouped.set(key,{...e,additionalSources:[]});continue;}
    if(e.sourceId!==previous.sourceId&&!previous.additionalSources.some(s=>s.url===e.url))previous.additionalSources.push({name:e.sourceName,url:e.url});
    if(e.description.length>previous.description.length)previous.description=e.description;
    for(const field of ['location','end','format','audience'])if(!previous[field]&&e[field])previous[field]=e[field];
    previous.tags=[...new Set([...previous.tags,...e.tags])];
    for(const field of ['food','snacks','drinks','free']){
      if(previous[field]==null)previous[field]=e[field];
      else if(e[field]!=null&&previous[field]!==e[field])previous[field]=null;
    }
    const detailTags={'Food provided':previous.food==='yes'||previous.snacks==='yes',Snacks:previous.snacks==='yes',Drinks:previous.drinks==='yes','Free admission':previous.free===true};
    previous.tags=previous.tags.filter(tag=>!(tag in detailTags)||detailTags[tag]);
  }
  return [...grouped.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}
const dateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'});
const timeFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',hour:'numeric',minute:'2-digit'});
export function localDate(event){if(event.allDay)return event.start.slice(0,10);return dateFormatter.format(new Date(event.start));}
export function timeLabel(event){return event.allDay?'All day':timeFormatter.format(new Date(event.start));}

export function lastDay(event){if(!event.end)return localDate(event);const end=new Date(event.end);end.setTime(end.getTime()-1);return event.allDay?end.toISOString().slice(0,10):dateFormatter.format(end);}
export function eventDays(event){const first=localDate(event),last=lastDay(event),out=[];const d=new Date(first+'T12:00:00Z');for(let i=0;i<400;i++){const key=d.toISOString().slice(0,10);if(key>last)break;out.push(key);d.setUTCDate(d.getUTCDate()+1);}return out;}
