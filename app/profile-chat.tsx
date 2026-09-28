'use client';
// Quick-reply onboarding chat for "Picked for you". The server (with the
// configured chat model) phrases each question and its clickable options;
// answers resolve to the calendar's interest vocabularies on the server and
// build the stored profile. A handful of exchanges, always skippable.
import {useEffect, useRef, useState} from 'react';
import {Bot, ChevronRight, MessageCircleQuestion, Sparkles} from 'lucide-react';
import {postJSON} from './account-client';

type ChatStep = {question: string; key: string; options: string[]; multiple: boolean};
type ChatAnswer = {question: string; key: string; options: string[]};
type ChatResponse = {done: boolean; step?: ChatStep; summary?: string};
type Message = {role: 'bot' | 'you'; text: string};

export default function ProfileChat({onFinished}: {onFinished: () => void}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<ChatStep | null>(null);
  const [answers, setAnswers] = useState<ChatAnswer[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyRef.current?.scrollTo({top: historyRef.current.scrollHeight});
  }, [messages, busy]);

  async function ask(next: ChatAnswer[], restart = false) {
    setBusy(true); setError('');
    try {
      const data = await postJSON<ChatResponse>('/api/profile/chat', restart ? {restart: true} : {answers: next}, 45000);
      if (data.done) {
        setStep(null); setFinished(true);
        setMessages(current => [...current, {role: 'bot', text: (data.summary || 'Your picks are ready.') + ' My calendar will keep an eye out for events like these.'}]);
      } else if (data.step) {
        setStep(data.step); setPicked([]);
        setMessages(current => [...current, {role: 'bot', text: data.step!.question}]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The picks chat is briefly unavailable.');
    } finally { setBusy(false); }
  }

  useEffect(() => { void ask([]); }, []);

  function answer(labels: string[]) {
    if (!step) return;
    const entry = {question: step.question, key: step.key, options: labels};
    const next = [...answers, entry];
    setAnswers(next);
    setMessages(current => [...current, {role: 'you', text: labels.length ? labels.join(', ') : 'Skipped'}]);
    void ask(next);
  }

  function restart() {
    setAnswers([]); setMessages([]); setFinished(false); setStep(null);
    void ask([], true);
  }

  function toggle(option: string) {
    setPicked(current => current.includes(option) ? current.filter(item => item !== option) : [...current, option]);
  }

  return (
    <div className="profile-dialog">
      <div className="eyebrow">PICKED FOR YOU</div>
      <h2>Tell it what you like.</h2>
      <p className="modal-intro">A few quick questions — just tap an answer. Your picks also learn from the events you open and save.</p>
      <div className="chat-history" ref={historyRef} aria-live="polite">
        {messages.map((message, index) => (
          <div className={'chat-bubble' + (message.role === 'you' ? ' chat-you' : '')} key={index}>
            {message.role === 'bot' && <Bot size={15}/>}<span>{message.text}</span>
          </div>
        ))}
        {busy && <div className="chat-bubble chat-typing"><Bot size={15}/><span>…</span></div>}
      </div>
      {error && <p className="form-error" role="alert">{error} <button className="text-button" onClick={() => (answers.length ? void ask(answers) : void ask([], !messages.length))}>Retry</button></p>}
      {step && !busy && !error && (
        <div className="chat-replies">
          {step.options.map(option => (
            <button key={option} className={'chat-reply' + (step.multiple && picked.includes(option) ? ' selected' : '')}
              aria-pressed={step.multiple ? picked.includes(option) : undefined}
              onClick={() => (step.multiple ? toggle(option) : answer([option]))}>
              {step.multiple && picked.includes(option) && '✓ '}{option}
            </button>
          ))}
          {step.multiple
            ? <button className="primary-button chat-next" disabled={!picked.length} onClick={() => answer(picked)}>Next<ChevronRight size={16}/></button>
            : <button className="text-button chat-skip" onClick={() => answer([])}>Skip this</button>}
        </div>
      )}
      {finished && (
        <div className="chat-done">
          <button className="primary-button" onClick={onFinished}><Sparkles size={16}/>See my picks</button>
          <button className="text-button" onClick={restart}>Start over</button>
        </div>
      )}
      <p className="chat-footnote"><MessageCircleQuestion size={14}/> Question wording comes from the calendar's AI assistant; your answers and every pick are computed on our servers.</p>
    </div>
  );
}
