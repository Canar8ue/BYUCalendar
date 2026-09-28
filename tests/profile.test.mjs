// Domain rules for "Picked for you": the quick-reply chat clamp, answer
// canonicalization onto the calendar vocabularies, decaying taste counters,
// and the deterministic recommendation pass. No Worker runtime needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChatPrompt,interpretChatStep,canonicalAnswer,profileFromAnswers,profileEmpty,decayedScore,nextActivityScore,scoreEvent,recommendEvents,ACTIVITY_HALF_LIFE_MS} from '../lib/profile.mjs';

const now=new Date('2026-09-28T18:00:00Z');
const answers=[
  {question:'What do you study or care about?',key:'interests',options:['Information systems','AIS']},
  {question:'Free food matter?',key:'food',options:['Free food']},
];

test('the chat prompt carries the vocabularies and answers, never secrets',()=>{
  const messages=buildChatPrompt(answers,now);
  assert.equal(messages.length,2);assert.equal(messages[0].role,'system');
  assert.match(messages[0].content,/Today is 2026-09-28/);
  assert.match(messages[0].content,/Information Systems|AIS/);
  assert.match(messages[0].content,/Campus life/);
  assert.match(messages[1].content,/What do you study/);
  assert.doesNotMatch(messages[0].content,/Bearer|API_KEY|sk-/);
  const empty=buildChatPrompt([],now);
  assert.match(empty[1].content,/\(none yet\)/);
});

test('chat steps are clamped to question/key/option shapes',()=>{
  const good=JSON.stringify({question:'Which subjects do you care about?',key:'interests',options:['Information systems','Accounting','Not sure'],multiple:true});
  assert.deepEqual(interpretChatStep('```json\n'+good+'\n```'),{done:false,question:'Which subjects do you care about?',key:'interests',options:['Information systems','Accounting','Not sure'],multiple:true});
  const done=interpretChatStep('Great — {"done":true,"summary":"IS events with free food"} thanks!');
  assert.deepEqual(done,{done:true,summary:'IS events with free food'});
  // Bad keys, too-short questions, and fewer than two options are rejected outright.
  assert.equal(interpretChatStep(JSON.stringify({question:'Which subjects do you care about?',key:'Bad Key!',options:['a','b']})),null);
  assert.equal(interpretChatStep(JSON.stringify({question:'Hi?',key:'ok',options:['a','b']})),null);
  assert.equal(interpretChatStep(JSON.stringify({question:'Which subjects do you care about?',key:'ok',options:['only one']})),null);
  assert.equal(interpretChatStep('no json here'),null);
  // Overlong options are trimmed to 36 characters, extras dropped past five.
  const trimmed=interpretChatStep(JSON.stringify({question:'Which subjects do you care about?',key:'kind',options:['x'.repeat(80),'aa','bb','cc','dd','ee','ff']}));
  assert.equal(trimmed.options.length,5);assert.ok(trimmed.options[0].length<=36);
});

test('answers canonicalize onto the real vocabularies and caps hold',()=>{
  assert.equal(canonicalAnswer('Information systems'),'IS');
  assert.equal(canonicalAnswer('free food'),'Food provided');
  assert.equal(canonicalAnswer('Career & business'),'Career & business');
  assert.equal(canonicalAnswer('robotics'),'');
  assert.equal(canonicalAnswer('none of these'),'');
  const profile=profileFromAnswers([
    {question:'q1',key:'interests',options:['IS','ais','Accounting','Finance','Marketing']},
    {question:'q2',key:'more',options:['Engineering','Computer Science','Math','ACME','Life Sciences']},
    {question:'q3',key:'even-more',options:['International','Law']},
    {question:'q4',key:'kind',options:['Career & business','made up kind']},
    {question:'q5',key:'details',options:['Free food','Online','Free admission','Snacks','Drinks']},
    {question:'q6',key:'over-cap-details',options:['Open invite','In person','Also made up']},
    {question:'q7',key:'skip',options:['Not sure']},
  ]);
  assert.equal(profile.interests.length,10);assert.ok(profile.interests.includes('AIS'));
  assert.deepEqual(profile.categories,['Career & business']);
  assert.equal(profile.details.length,5);
  assert.ok(profileEmpty({interests:[],categories:[],details:[]}));
  assert.ok(!profileEmpty(profile));
});

test('taste counters decay with a 45-day half-life',()=>{
  const stamp='2026-09-28T18:00:00.000Z';
  assert.equal(decayedScore(4,stamp,now.getTime()),4);
  const half=decayedScore(4,stamp,now.getTime()+ACTIVITY_HALF_LIFE_MS);
  assert.ok(Math.abs(half-2)<0.001);
  const quarter=decayedScore(4,stamp,now.getTime()+2*ACTIVITY_HALF_LIFE_MS);
  assert.ok(Math.abs(quarter-1)<0.001);
  assert.equal(nextActivityScore(4,stamp,3,now.getTime()),7);
  // A stale counter decays before the new action is added.
  const aged=nextActivityScore(4,'2026-06-01T00:00:00.000Z',3,now.getTime());
  assert.ok(aged>3&&aged<7);
});

const base={description:'',location:'TNRB 260',url:'https://byu.edu',allDay:false,cancelled:false,end:null,sourceId:'byu',sourceName:'BYU Events',category:'Career & business',sourceUpdated:null};
const event=overrides=>({...base,id:'byu:test',title:'Test event',start:'2026-10-01T17:00:00.000Z',tags:[],...overrides});

test('scoring excludes saved, cancelled, past, and distant events',()=>{
  const profile={interests:['IS'],categories:[],details:[]};
  assert.equal(scoreEvent(event({id:'saved-one'}),{profile,savedIds:['saved-one'],now}),null);
  assert.equal(scoreEvent(event({cancelled:true}),{profile,now}),null);
  assert.equal(scoreEvent(event({start:'2026-09-01T17:00:00.000Z'}),{profile,now}),null);
  assert.equal(scoreEvent(event({start:'2026-12-20T17:00:00.000Z'}),{profile,now}),null);
});

test('scoring blends stated interests, activity, and freshness with readable reasons',()=>{
  const profile={interests:['IS','Networking'],categories:['Career & business'],details:[]};
  const activity=new Map([['IS',3],['Accounting',2]]);
  const strong=scoreEvent(event({tags:['IS','Networking','Clubs']}),{profile,activity,now});
  const weak=scoreEvent(event({tags:['Accounting']}),{profile,activity,now});
  assert.ok(strong.score>weak.score);
  // Stated interest 2.5 + activity 2*3 + second tag 2.5 + category 1.5 + freshness.
  assert.ok(strong.score>8.5);
  assert.deepEqual(strong.reasons,['IS','Networking','Career & business']);
  // The weak event only carries the category preference plus its activity drift.
  assert.deepEqual(weak.reasons,['Accounting','Career & business']);
  const fresh=scoreEvent(event({tags:['Accounting'],start:'2026-09-29T17:00:00.000Z'}),{profile,activity,now});
  assert.ok(fresh.score>weak.score,'sooner events rank above identical later ones');
});

test('recommendations rank, cap, exclude saved events, and stay quiet without signal',()=>{
  const profile={interests:['IS'],categories:[],details:[]};
  const events=[
    event({id:'a',title:'AIS social',tags:['IS','AIS','Clubs'],start:'2026-09-30T17:00:00.000Z'}),
    event({id:'b',title:'Accounting night',tags:['Accounting'],start:'2026-09-30T18:00:00.000Z'}),
    event({id:'c',title:'IS workshop later',tags:['IS'],start:'2026-10-20T17:00:00.000Z'}),
    event({id:'d',title:'Unrelated',tags:[],start:'2026-09-30T19:00:00.000Z'}),
  ];
  const picks=recommendEvents(events,{profile,activityRows:[{kind:'tag',value:'IS',score:2}],savedIds:['a'],now,limit:2});
  assert.deepEqual(picks.map(p=>p.id),['c']);
  const ranked=recommendEvents(events,{profile,activityRows:[{kind:'tag',value:'IS',score:2}],savedIds:[],now,limit:10});
  assert.deepEqual(ranked.map(p=>p.id),['a','c']);
  assert.ok(ranked[0].reasons.includes('IS'));
  // No profile and no activity: nothing clears the bar, so the panel shows its prompt instead.
  assert.deepEqual(recommendEvents(events,{profile:null,activityRows:[],now}),[]);
  // Activity alone can carry a pick when the profile is empty.
  const activityOnly=recommendEvents(events,{profile:null,activityRows:[{kind:'tag',value:'Accounting',score:4}],now});
  assert.deepEqual(activityOnly.map(p=>p.id),['b']);
});
