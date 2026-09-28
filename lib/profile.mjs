// Interest-profile chat and traditional recommendation scoring for "Picked
// for you" on My calendar. The chat asks a handful of quick-reply questions;
// the question text and option wording come from the configured chat model
// (DeepSeek by default) but are clamped here to the calendar's own
// vocabularies, and every recommendation is computed deterministically on our
// servers from the stored profile plus exponentially-decayed activity
// counters — no model involvement in ranking.
import {CATEGORIES,INTEREST_TAGS,localDate,lastDay} from './catalog.mjs';
import {dayKey} from './search.mjs';
import {extractJSON} from './search-assist.mjs';

export const PROFILE_CATEGORIES=CATEGORIES.map(category=>category.id);
export const PROFILE_INTERESTS=INTEREST_TAGS;
export const PROFILE_DETAILS=['Food provided','Snacks','Drinks','Free admission','Open invite','In person','Online'];
export const CHAT_MAX_STEPS=5;
// Conversation phrasing a member is allowed to pick; answers map onto the
// canonical vocabularies below, anything else is conversation-only.
const VOCABULARY=[...PROFILE_INTERESTS,...PROFILE_CATEGORIES,...PROFILE_DETAILS];
const VOCABULARY_LOOKUP=new Map(VOCABULARY.map(value=>[value.toLowerCase(),value]));
const ANSWER_ALIASES=new Map([
  ['free food','Food provided'],['food','Food provided'],['anything free','Free admission'],
  // The model phrases options naturally; map common multi-word wordings onto
  // the short canonical tags they mean.
  ['information systems','IS'],['info systems','IS'],['cs','Computer Science'],
  ['career and business','Career & business'],['arts and culture','Arts & culture'],
  ['sports and recreation','Sports & recreation'],['faith and learning','Faith & learning'],
  ['both',''],['everything',''],['all of them',''],['none of these',''],['not sure',''],['no preference',''],['skip',''],
]);

// How strongly one recorded action counts toward a taste. Saving is the
// clearest signal; passive views count the least.
export const ACTIVITY_WEIGHTS={event_view:1,save:3,share:2,directions:2,export:2,map_view:2};
// Interest decays with a 45-day half-life: this semester's habits matter,
// last semester's fade out.
export const ACTIVITY_HALF_LIFE_MS=45*86400000;

export function buildChatPrompt(answers,now=new Date()){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver'}).format(now);
  const qa=answers.length?answers.map(a=>`${a.question} -> ${(a.options||[]).join('; ')||'(skipped)'}`).join('\n'):'(none yet)';
  const system=[
    'You are the friendly onboarding assistant for BYU Calendar (byucalendar.com), a campus events calendar for Brigham Young University in Provo, Utah.',
    `Today is ${today}. You ask ONE short question at a time to learn what kind of campus events the member cares about, so the calendar can suggest events.`,
    'Respond with ONLY a JSON object — no prose, no code fences — shaped exactly like one of:',
    '{"question":"...","key":"...","options":["...","..."],"multiple":false}',
    '{"done":true,"summary":"..."}',
    'Rules:',
    '- Ask about interests and event kinds first (what they study or care about), then practical preferences (food, cost, in person vs online).',
    `- Interest options should come from these real calendar interests: ${PROFILE_INTERESTS.join(', ')}.`,
    `- Event-kind options should come from: ${PROFILE_CATEGORIES.join(', ')}.`,
    `- Practical options can use: ${PROFILE_DETAILS.join(', ')}.`,
    '- question: at most 110 characters, warm and plain, no emojis, no greetings after the first question.',
    '- key: a short stable slug for the question (2-24 chars, letters/numbers/dashes), unique per question.',
    '- options: 3 to 5 short options (each 2-30 characters). Include one escape option like "None of these" or "Not sure" when fitting.',
    '- multiple: true when picking several options is natural (interests), false for single-choice questions.',
    `- Ask at most ${CHAT_MAX_STEPS} questions total. When you have enough (or the answers say so), return done with a one-line summary of their taste (max 90 characters), e.g. "IS and AIS events with free food".`,
    '- Never ask for names, emails, or anything identifying. Never invent events.',
  ].join('\n');
  return [{role:'system',content:system},{role:'user',content:'Answers so far:\n'+qa+'\n\nGive the next question, or finish with done.'}];
}

const cleanText=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const KEY_SHAPE=/^[a-z0-9][a-z0-9-]{1,23}$/;

// Clamps a model-supplied chat step to the shapes above; null when unusable,
// so the caller can fail honestly instead of rendering model prose.
export function interpretChatStep(text){
  const raw=extractJSON(text);
  if(!raw||typeof raw!=='object')return null;
  if(raw.done===true){
    const summary=cleanText(raw.summary,90);
    return {done:true,summary:summary||'Your picks are ready.'};
  }
  const question=cleanText(raw.question,120);
  const key=String(raw.key||'').toLowerCase().trim();
  const options=[...new Set((Array.isArray(raw.options)?raw.options:[]).map(option=>cleanText(option,36)).filter(option=>option.length>=2))].slice(0,5);
  if(question.length<8||!KEY_SHAPE.test(key)||options.length<2)return null;
  return {done:false,question,key,options,multiple:raw.multiple===true};
}

// Maps chosen quick replies onto the canonical vocabularies. Unrecognized
// wording stays conversation-only; caps keep a playful answer set from
// becoming a blanket "everything" profile.
export function canonicalAnswer(value){
  const text=String(value??'').trim().toLowerCase();
  if(!text)return '';
  if(ANSWER_ALIASES.has(text))return ANSWER_ALIASES.get(text);
  return VOCABULARY_LOOKUP.get(text)||'';
}
export function profileFromAnswers(answers){
  const interests=new Set(),categories=new Set(),details=new Set();
  for(const answer of (Array.isArray(answers)?answers:[]).slice(0,CHAT_MAX_STEPS+1)){
    for(const option of (Array.isArray(answer?.options)?answer.options:[]).slice(0,5)){
      const value=canonicalAnswer(option);
      if(!value)continue;
      if(PROFILE_INTERESTS.includes(value))interests.add(value);
      else if(PROFILE_CATEGORIES.includes(value))categories.add(value);
      else if(PROFILE_DETAILS.includes(value))details.add(value);
    }
  }
  return {interests:[...interests].slice(0,10),categories:[...categories].slice(0,4),details:[...details].slice(0,5)};
}
export function profileEmpty(profile){
  return !profile||(!profile.interests?.length&&!profile.categories?.length&&!profile.details?.length);
}

// Exponentially-decayed taste counters: existing score first ages by the time
// since it was last touched, then the new action's weight is added.
export function decayedScore(score,updatedAt,now=Date.now()){
  const age=now-Date.parse(updatedAt||'');
  if(!Number.isFinite(age)||age<=0)return score;
  return score*Math.pow(0.5,age/ACTIVITY_HALF_LIFE_MS);
}
export function nextActivityScore(score,updatedAt,weight,now=Date.now()){
  return decayedScore(score,updatedAt,now)+weight;
}

// Deterministic recommendation pass. Every contribution below is a plain
// weight: stated profile interests, engaged categories/tags (decayed), a small
// practical-detail bonus, and a gentle so-moreish-sooner freshness nudge.
// Returns picks with the human-readable reasons that drove them.
export function scoreEvent(event,{profile,activity=new Map(),savedIds=[],now=new Date()}={}){
  const saved=new Set(savedIds);
  if(saved.has(event.id)||event.cancelled)return null;
  const today=dayKey(now);
  const firstDay=localDate(event);
  if(lastDay(event)<today||firstDay>new Date(now.getTime()+45*86400000).toISOString().slice(0,10))return null;
  const activityFor=value=>activity.get(value)||0;
  const reasons=[];
  let score=0;
  for(const tag of event.tags||[]){
    if(PROFILE_INTERESTS.includes(tag)){
      // Stated interests carry the base weight; unstated tags count only
      // through what the member actually does.
      const contribution=(profile?.interests?.includes(tag)?2.5:0)+2*activityFor(tag);
      if(contribution>0){score+=contribution;reasons.push({label:tag,contribution});}
    }else if(PROFILE_DETAILS.includes(tag)){
      const contribution=(profile?.details?.includes(tag)?1.2:0)+1*activityFor(tag);
      if(contribution>0){score+=contribution;reasons.push({label:tag,contribution});}
    }
  }
  if(profile?.categories?.includes(event.category)){score+=1.5;reasons.push({label:event.category,contribution:1.5});}
  score+=1.5*activityFor(event.category);
  const daysAhead=Math.max(0,(Date.parse(event.start)-now.getTime())/86400000);
  score+=Math.max(0,1-daysAhead/45)*0.8;
  reasons.sort((a,b)=>b.contribution-a.contribution);
  return {score,reasons:reasons.slice(0,3).map(reason=>reason.label)};
}

export function recommendEvents(events,{profile,activityRows=[],savedIds=[],now=new Date(),limit=12,threshold=2}={}){
  const activity=new Map((Array.isArray(activityRows)?activityRows:[]).filter(row=>row&&(row.kind==='tag'||row.kind==='category')).map(row=>[row.value,row.score]));
  const scored=[];
  for(const event of events){
    const result=scoreEvent(event,{profile,activity,savedIds,now});
    if(result&&result.score>=threshold)scored.push({id:event.id,score:Math.round(result.score*100)/100,reasons:result.reasons});
  }
  scored.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return scored.slice(0,limit);
}
