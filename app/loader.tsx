"use client";
import {useState,useEffect,type CSSProperties} from 'react';
import BrandY from './brand-y';
// Split-curtain launch screen in BYU blue: the wordmark's letters rise once
// from their masks, the floating brand hovers above, and the upcoming-events
// count lands in the bottom-right; once the calendar data is in, the content
// slides away and the two panels split open to reveal the calendar.
const WORDS:[string,boolean][]=[['Find',false],['your',false],['next',true],['Event.',true]];
export default function LaunchLoader({ready,count}:{ready:boolean;count:number}){
 const [minWait,setMinWait]=useState(false),[gone,setGone]=useState(false);
 let index=0;
 useEffect(()=>{const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;document.body.classList.add('is-launching');const timer=setTimeout(()=>setMinWait(true),reduced?100:400);return()=>{clearTimeout(timer);document.body.classList.remove('is-launching');};},[]);
 // The exit state is derived (data in + minimum showtime), not stored, so the
 // curtain choreography lives in CSS; this effect only schedules the unmount.
 const exit=ready&&minWait&&!gone;
 useEffect(()=>{if(!exit)return;document.body.classList.remove('is-launching');const timer=setTimeout(()=>setGone(true),650);return()=>clearTimeout(timer);},[exit]);
 if(gone)return null;
 return <div className={'loader'+(exit?' loader--exit':'')} role="status" aria-label="Loading BYU Calendar"><div className="loader-panel loader-panel-top" aria-hidden="true"/><div className="loader-panel loader-panel-bottom" aria-hidden="true"/><div className="loader-content" aria-hidden="true"><div className="loader-brand"><BrandY className="loader-brand-y"/><span>BYU<span className="loader-brand-light"> Calendar</span></span></div><div className="loader-wordmark"><div className="loader-word">{WORDS.map(([word,italic])=><span className="loader-line" key={word}>{[...word].map(ch=>{const i=index++;return <span key={i} className={'l'+(italic?' l--italic':'')} style={{'--i':i} as CSSProperties}><i>{ch}</i></span>;})}{word!=='Event.'&&<span className="l l--gap" aria-hidden="true"/>}</span>)}</div></div>{ready&&<div className="loader-events"><b>{count}</b>upcoming events</div>}</div></div>;
}
