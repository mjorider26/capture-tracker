import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AskAiExperience } from "@/components/ask-ai-experience";
import { askAuthenticatedAi, feedbackAuthenticatedAi } from "./actions";
import { getAskAiConversations } from "@/lib/services/ask-ai";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
export const dynamic = "force-dynamic";
export default async function AskAiPage() { const c = await getContext(); const conversations = await getAskAiConversations(c.business.id); return <AppShell mode="app" destination="ask-ai" businessName={c.business.displayName}><AskAiExperience conversations={conversations} basePath="/app" askAction={askAuthenticatedAi} feedbackAction={feedbackAuthenticatedAi}/></AppShell>; }
async function getContext() { try { return await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } }
