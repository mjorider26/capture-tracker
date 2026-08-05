"use client";

import Link from "next/link";
import { useActionState } from "react";

type State = { ok: boolean; message?: string };
type Action = (state: State, form: FormData) => Promise<State>;
type Conversation = {
  id: string;
  title: string;
  updatedAt: Date;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    run: null | { id: string; status: string; evidenceAsOf: Date | null; evidence: Array<{ id: string; displayLabel: string; route: string | null }> };
  }>;
};

const initial: State = { ok: false };
const prompts = [
  "How did my business perform this month?",
  "What should I review this week?",
  "What documents need attention?",
  "What cash activity is recorded?",
];

export function AskAiExperience({
  conversations,
  activeConversationId,
  basePath,
  askAction,
  feedbackAction,
  newAction,
}: {
  conversations: Conversation[];
  activeConversationId?: string;
  basePath: "/app" | "/demo";
  askAction: Action;
  feedbackAction: Action;
  newAction: Action;
}) {
  const [askState, ask] = useActionState(askAction, initial);
  const [feedbackState, feedback] = useActionState(feedbackAction, initial);
  const [newState, newConversation] = useActionState(newAction, initial);
  const current = conversations.find((item) => item.id === activeConversationId) ?? conversations[0];

  return (
    <div className="ask-ai-workspace grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="ask-ai-sidebar ui-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div><p className="ui-page-eyebrow font-bold uppercase">Workspace memory</p><h2 className="mt-1 font-bold">Conversations</h2></div>
          <form action={newConversation}><button className="ui-button ui-button-secondary min-h-9 rounded border border-border-subtle px-2 text-xs font-bold">New</button></form>
        </div>
        <p className="mt-2 text-xs leading-5 text-text-muted">Stored only in this business.</p>
        {newState.message && <p className="mt-3 text-xs text-text-muted" role="status">{newState.message}</p>}
        {conversations.length === 0 ? (
          <p className="mt-6 text-sm leading-6 text-text-muted">No conversations yet. Start with a focused question about your books.</p>
        ) : (
          <ul className="mt-5 space-y-1.5">
            {conversations.map((item) => (
              <li key={item.id}>
                <Link href={`${basePath}/ask-ai?conversation=${encodeURIComponent(item.id)}`} className={`ask-ai-thread block truncate rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-semibold ${item.id === current?.id ? "is-active" : ""}`}>
                  {item.title}<span className="mt-1 block text-xs font-normal text-text-muted">{item.updatedAt.toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="ask-ai-stage ui-card min-w-0 p-5 sm:p-7">
        <header className="ui-page-header mb-6">
          <p className="ui-page-eyebrow font-bold uppercase">Read-only intelligence</p>
          <h1 className="ui-page-title mt-2 text-3xl font-bold tracking-[-0.055em]">Ask about your books</h1>
          <p className="ui-page-description mt-3 max-w-2xl text-sm text-text-muted">Grounded answers from your Capture Tracker records. No external provider is connected.</p>
        </header>
        {!current && <div className="auth-note rounded-[var(--radius-md)] p-4 text-sm leading-6 text-text-muted">Start with a question about your business performance, weekly review, documents, or recorded cash activity.</div>}
        <form action={ask} className="ask-ai-composer mt-5 rounded-[var(--radius-md)] p-4">
          <input type="hidden" name="conversationId" value={current?.id ?? ""} />
          <label className="block text-sm font-bold">Question<textarea required maxLength={800} name="question" className="ui-input mt-2 min-h-28" placeholder="How did my business perform this month?" /></label>
          <div className="mt-3 flex flex-wrap gap-2">
            {prompts.map((question) => <button key={question} type="submit" name="question" value={question} className="ask-ai-prompt rounded px-3 py-2 text-xs font-bold">{question}</button>)}
            <button className="ui-button ui-button-primary rounded bg-brand-navy px-4 py-2 text-sm font-bold text-white">Ask</button>
          </div>
        </form>
        {askState.message && <p className="mt-3 text-sm text-text-muted" role="status">{askState.message}</p>}
        <div className="mt-7 space-y-4">
          {current?.messages.map((message) => (
            <article key={message.id} className={`ask-ai-message ${message.role === "USER" ? "is-user" : "is-assistant"}`}>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{message.role === "USER" ? "You" : "Ask AI"}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
              {message.run && <>
                <div className="mt-4 flex flex-wrap gap-2">{message.run.evidence.map((evidence) => evidence.route ? <Link key={evidence.id} href={`${basePath}${evidence.route}`} className="ask-ai-evidence">{evidence.displayLabel}</Link> : <span key={evidence.id} className="ask-ai-evidence">{evidence.displayLabel}</span>)}</div>
                <form action={feedback} className="mt-4 flex flex-wrap gap-3"><input type="hidden" name="runId" value={message.run.id} /><button name="rating" value="HELPFUL" className="ui-link text-xs">Helpful</button><button name="rating" value="NOT_HELPFUL" className="ui-link text-xs">Not helpful</button><button name="rating" value="INCORRECT" className="ui-link text-xs">Incorrect</button></form>
              </>}
            </article>
          ))}
        </div>
        {feedbackState.message && <p className="mt-3 text-xs text-text-muted" role="status">{feedbackState.message}</p>}
      </section>
    </div>
  );
}
