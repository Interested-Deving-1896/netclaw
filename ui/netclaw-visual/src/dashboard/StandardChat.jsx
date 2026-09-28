import React, { useEffect, useRef, useState } from 'react';

const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value);
const makeThread = () => `chat-${globalThis.crypto.randomUUID()}`;
const demoMessages = [
  { role: 'user', content: 'How should I start investigating an intermittent routing issue?' },
  { role: 'assistant', content: 'Synthetic example — no tools were run.\n\nStart by recording the affected path, timestamps and symptoms. Compare current routing and interface observations with the intended design before proposing a change.' },
];
export default function StandardChat({ preview = false, active = true }) {
  const [messages, setMessages] = useState(() => preview ? demoMessages : []);
  const [draft, setDraft] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState('');
  const thread = useRef(null), sending = useRef(false), composer = useRef(null), transcript = useRef(null);
  if (thread.current === null) thread.current = makeThread();
  useEffect(() => { if (active && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; }, [messages, pending, active]);
  const send = async event => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || sending.current || preview) return;
    sending.current = true; setPending(true); setError('');
    const before = messages, context = [...messages, { role: 'user', content: prompt }];
    setMessages(context); setDraft('');
    try {
      const session = await fetch('/api/hud/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      if (!session.ok) throw Error('The private HUD session is unavailable. Your draft has been restored.');
      const response = await fetch('/api/chat', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, messages: context.slice(-40).map(({ role, content }) => ({ role, content })), hudThread: thread.current }),
      });
      if (!response.ok) throw Error(`Chat request failed (HTTP ${response.status}). Your draft has been restored. Check the gateway before retrying; the request may already have started.`);
      const data = await response.json();
      if (data.fromGateway !== true) throw Error('The gateway did not return a confirmed reply. Check its connection and chat compatibility endpoint before retrying. Your draft has been restored.');
      if (typeof data.response !== 'string' || !data.response.trim()) throw Error('The gateway returned an empty reply. Check the gateway before retrying; your draft has been restored.');
      const assessmentRefs = (Array.isArray(data.assessmentRefs) ? data.assessmentRefs : [])
        .filter(ref => validId(ref?.taskRef) && validId(ref?.assessmentId)).slice(0, 20);
      setMessages([...context, { role: 'assistant', content: data.response, assessmentRefs }]);
    } catch (err) {
      setMessages(before); setDraft(prompt);
      setError(err instanceof TypeError || err instanceof SyntaxError ? 'The reply could not be received. Your draft has been restored. The gateway may still be working; check before retrying.' : err.message || 'Chat unavailable. Your draft has been restored.');
    } finally { sending.current = false; setPending(false); }
  };
  const reset = () => {
    if (sending.current || preview) return;
    if ((messages.length || draft) && !window.confirm('Start a new chat? This clears the conversation and draft in this tab. Gateway records are not deleted.')) return;
    thread.current = makeThread(); setMessages([]); setDraft(''); setError(''); composer.current?.focus();
  };
  return <section className="standard-chat" aria-label="Standard Chat">
    <div className="chat-intro"><div><span className="eyebrow">Your network engineering coworker</span><h2>A conversation with NetClaw</h2><p>Ask a question, review the evidence, then follow up.</p></div><button onClick={reset} disabled={pending || preview}>New chat</button></div>
    <div className="chat-transcript" ref={transcript} role="log" aria-label="Chat conversation" aria-live="polite" aria-relevant="additions" aria-busy={pending}>
      {!messages.length && <div className="chat-empty"><span className="chat-monogram" aria-hidden="true">N›</span><h3>What would you like to investigate?</h3><p>Try asking about network health, a routing issue, or one of your uploaded design guides.</p><small>Requests use your configured gateway and existing approval rules.</small></div>}
      {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={index}><span className="chat-author">{message.role === 'user' ? 'You' : preview ? 'NetClaw · synthetic preview' : 'NetClaw'}</span><div className="chat-message-text">{message.content}</div>{message.assessmentRefs?.map(ref => <a key={`${ref.taskRef}:${ref.assessmentId}`} className="utility-link" href={`/assessment.html?task=${encodeURIComponent(ref.taskRef)}&assessment=${encodeURIComponent(ref.assessmentId)}`} target="_blank" rel="noopener noreferrer">Open Jev assessment ↗</a>)}</article>)}
      {pending && <p className="chat-working" role="status">NetClaw is working… Tool-based investigations can take several minutes.</p>}
    </div>
    {error && <div className="chat-error" role="alert">{error}</div>}
    <form className="chat-composer" onSubmit={send}>
      <label htmlFor="standard-chat-message">Message NetClaw</label>
      <div className="chat-compose-row"><textarea id="standard-chat-message" ref={composer} value={draft} onChange={event => setDraft(event.target.value)} placeholder={preview ? 'Synthetic preview — sending is disabled' : 'Ask NetClaw…'} rows={3} maxLength={20000} disabled={pending || preview} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) send(event); }}/><button className="primary" type="submit" disabled={pending || preview || !draft.trim()}>{pending ? 'Working…' : 'Send message'}</button></div>
      <p className="chat-footnote">Enter to send · Shift+Enter for a new line. This tab keeps your conversation while you navigate; reload clears this view. Gateway records follow runtime retention. The latest 40 messages are sent as context.</p>
    </form>
  </section>;
}
