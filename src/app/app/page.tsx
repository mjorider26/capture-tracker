import { notFound, redirect } from "next/navigation";

import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";

export default async function ApplicationHomePage() {
  try {
    await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) {
      if (error.status === 401) redirect("/sign-in");
      notFound();
    }
    throw error;
  }

  redirect("/app/today");
}
