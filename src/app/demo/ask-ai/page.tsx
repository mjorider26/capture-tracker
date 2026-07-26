import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AskAiExperience } from "@/components/ask-ai-experience";
import { getAskAiConversations } from "@/lib/services/ask-ai";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { askDemoAi, feedbackDemoAi } from "./actions";
export const dynamic = "force-dynamic";
export default async function DemoAskAiPage() { const c = await resolveLocalDemoContext(); if (!c) notFound(); return <AppShell mode="demo" destination="ask-ai" businessName={c.businessName}><AskAiExperience conversations={await getAskAiConversations(c.businessId)} basePath="/demo" askAction={askDemoAi} feedbackAction={feedbackDemoAi}/></AppShell>; }
