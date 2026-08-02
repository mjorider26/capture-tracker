import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AskAiExperience } from "@/components/ask-ai-experience";
import { getAskAiConversations } from "@/lib/services/ask-ai";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { askDemoAi, feedbackDemoAi, newDemoAiConversation } from "./actions";
export const dynamic = "force-dynamic";
export default async function DemoAskAiPage({searchParams}:{searchParams:Promise<{conversation?:string}>}) { const c = await resolveLocalDemoContext(); if (!c) notFound(); const conversations=await getAskAiConversations(c.businessId); const requested=(await searchParams).conversation; return <AppShell mode="demo" destination="ask-ai" businessName={c.businessName}><AskAiExperience conversations={conversations} activeConversationId={conversations.some(item=>item.id===requested)?requested:undefined} basePath="/demo" askAction={askDemoAi} feedbackAction={feedbackDemoAi} newAction={newDemoAiConversation}/></AppShell>; }
