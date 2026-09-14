import test from 'node:test';
import assert from 'node:assert/strict';
import ICAL from 'ical.js';
import {parseICS,classify,clean,civilToISO,eventDays,mergeEvents} from '../lib/catalog.mjs';
import {parseSearch,matchesEvent,exportICS} from '../lib/search.mjs';
import {listingLinks,eventPage,importSource,sameSite} from '../lib/source-import.mjs';
import {parseClubSnapshot} from '../lib/club-snapshot.mjs';
const source={id:'test',name:'Test',url:'https://calendar.byu.edu',category:'Campus life'};
const now=new Date('2026-09-14T18:00:00Z');
const wrap=s=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+s+'\r\nEND:VCALENDAR';
const record=(start,end='',more='')=>`BEGIN:VEVENT\r\nUID:stable-123\r\nSUMMARY:Campus meetup\r\nDTSTART${start}\r\n${end?'DTEND'+end+'\r\n':''}${more}\r\nEND:VEVENT`;
test('Denver conversion changes offset at DST boundaries',()=>{assert.equal(civilToISO('2026-09-17 18:00:00'),'2026-09-18T00:00:00.000Z');assert.equal(civilToISO('2026-12-17 18:00:00'),'2026-12-18T01:00:00.000Z');});
test('rescheduling keeps single-event identity and repairs impossible end time',()=>{const a=parseICS(wrap(record(':20260917T180000Z',':20260917T170000Z')),source,now)[0];const b=parseICS(wrap(record(':20260917T190000Z')),source,now)[0];assert.equal(a.id,b.id);assert.equal(a.end,null);});
test('recurrence exclusions and moved instances retain original occurrence identities',()=>{const recurring=record(':20260915T180000Z',':20260915T190000Z','RRULE:FREQ=WEEKLY;COUNT=3\r\nEXDATE:20260922T180000Z');const exception='BEGIN:VEVENT\r\nUID:stable-123\r\nRECURRENCE-ID:20260929T180000Z\r\nSUMMARY:Moved meetup\r\nDTSTART:20260929T200000Z\r\nDTEND:20260929T210000Z\r\nEND:VEVENT';const events=parseICS(wrap(recurring+'\r\n'+exception),source,now);assert.equal(events.length,2);assert.equal(events[1].start,'2026-09-29T20:00:00.000Z');});
test('all-day ranges exclude DTEND and match searches during the event',()=>{const e=parseICS(wrap(record(';VALUE=DATE:20260923',';VALUE=DATE:20260926')),source,now)[0];assert.deepEqual(eventDays(e),['2026-09-23','2026-09-24','2026-09-25']);assert.ok(matchesEvent(e,'today',[],[],new Date('2026-09-24T18:00:00Z')));});
test('unknown locations and negated perks never produce positive filters',()=>{const e=classify({title:'Campus meetup',description:'No free food. Snacks not provided.',location:null,url:'',sourceId:'test'});assert.equal(clean(null),'');assert.equal(e.format,null);assert.equal(e.food,'no');assert.equal(e.snacks,'no');assert.ok(!e.tags.includes('Food provided'));assert.ok(!e.tags.includes('Free food'));});
test('food is distinct from admission, dates and ordinary is are understood',()=>{const e=classify({title:'Campus meetup',description:'Free pizza provided. All BYU students welcome.',location:'Tanner Building',url:'',sourceId:'test',start:'2026-09-17T23:30:00Z',allDay:false});assert.equal(e.free,null);assert.ok(matchesEvent(e,'free food this week after 5 pm',[],[],now));assert.deepEqual(parseSearch('what is happening today',now).tags,[]);assert.deepEqual(parseSearch('IS networking',now).tags,['IS','Networking']);});
test('duplicates retain provenance and exports are valid calendars',()=>{const a=parseICS(wrap(record(':20260917T180000Z')),source,now)[0];const merged=mergeEvents([a,{...a,sourceId:'other',sourceName:'Other',url:'https://example.com'}]);assert.equal(merged.length,1);assert.equal(merged[0].additionalSources.length,1);const calendar=new ICAL.Component(ICAL.parse(exportICS(merged)));assert.equal(calendar.getAllSubcomponents('vevent').length,1);});

test('club identity supplies subject filters and combined food statements are recognized',()=>{
 const e=classify({title:'Opening Social',description:'Pizza and drinks will be provided.',sourceId:'accounting-society',url:'',location:'TNRB 408',start:'2026-09-18T01:00:00Z',allDay:false});
 assert.ok(matchesEvent(e,'accounting clubs food drinks',[],[],now));assert.equal(e.free,null);
 const snack=classify({...e,sourceId:'engineering',description:'Pick up merch and snacks while you look!'});assert.equal(snack.snacks,'yes');
 assert.equal(clean('Learn &#x2014; connect &#128075;'),'Learn — connect 👋');
});
test('dedupe keeps richer details and separates generic socials from different clubs',()=>{
 const a=parseICS(wrap(record(':20260917T180000Z')),source,now)[0];
 const b=classify({...a,sourceId:'cs',sourceName:'Computer Science',title:'BYU '+a.title,description:'Pizza and drinks will be provided.'});
 const merged=mergeEvents([a,b]);assert.equal(merged.length,1);assert.equal(merged[0].food,'yes');assert.match(merged[0].description,/Pizza/);
 assert.equal(mergeEvents([{...a,title:'Opening Social'},{...b,title:'Opening Social'}]).length,2);
});
test('website discovery stays on site and reads dates from downloads instead of stale URL slugs',async()=>{
 const club={id:'accounting-society',name:'Accounting Society',url:'https://accountingsociety.byu.edu/',kind:'brightspot-pages',category:'Career & business'};
 const listing='<div class="ListUpcomingEvents"><table class="ListUpcomingEvents-table"><a href="/old-2025-01-01">Updated event</a><a href="https://attacker.example/event">Ignore</a></table></div>';
 assert.deepEqual(listingLinks(listing,club).links,[club.url+'old-2025-01-01']);assert.equal(sameSite('http://127.0.0.1/',club.url),null);
 const detail='<a href="/_event.ics?e=stable">Add to Calendar</a><div class="EventPage-eventBody">Pizza provided.</div>';
 assert.equal(eventPage(detail,club.url).feed,club.url+'_event.ics?e=stable');
 const read=async url=>url===club.url?listing:url.includes('_event.ics')?wrap(record(':20261029T170000Z',':20261029T180000Z')):detail;
 const imported=await importSource(club,{now,read});assert.equal(imported.events[0].start,'2026-10-29T17:00:00.000Z');assert.equal(imported.events[0].food,'yes');assert.equal(imported.events[0].url,club.url+'old-2025-01-01');
});
test('partial page failures retain known events and unexpected layouts fail instead of erasing data',async()=>{
 const club={id:'cs',name:'Computer Science',url:'https://cs.byu.edu/calendar',kind:'brightspot-pages'};
 const listing='<div class="ListUpcomingEvents"><table class="ListUpcomingEvents-table"><a href="/good">Good</a><a href="/offline">Offline</a></table></div>';
 const old={...parseICS(wrap(record(':20260917T180000Z')),source,now)[0],url:'https://cs.byu.edu/offline'};
 const read=async url=>{if(url.endsWith('/offline'))throw new Error('Offline');return url===club.url?listing:url.includes('_event.ics')?wrap(record(':20260918T180000Z')):'<a href="/_event.ics?e=good">Add</a>';};
 const result=await importSource(club,{now,read,previous:[old]});assert.equal(result.events.length,2);assert.match(result.warning,/1 event pages/);assert.ok(result.events.some(e=>e.id===old.id));
 assert.throws(()=>listingLinks('<main>Login</main>',club),/format changed/);
});
test('club snapshots preserve explicit next-year dates and keep unknown details unknown',()=>{
 const capture={capturedAt:'2026-09-14T22:00:00Z',calendarYear:2026,rows:[{title:'Clubs Rush',organization:'BYUSA Clubs Area',date:'Tuesday, January 12 2027 12:00 PM',location:'WSC Garden Court'},{title:'Opening Social',organization:'Women in Finance',date:'Tuesday, September 15 7:00 PM',location:'TBA'}]};
 const result=parseClubSnapshot(capture);assert.equal(result[0].start,'2027-01-12T19:00:00.000Z');assert.equal(result[1].end,null);assert.equal(result[1].format,null);assert.equal(result[1].food,null);assert.ok(result[1].tags.includes('Finance'));assert.match(result[1].description,/does not refresh automatically/);assert.ok(result[0].id.length<100);
});
