import { notFound, redirect } from "next/navigation";

import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthenticatedApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) {
      if (error.status === 401) redirect("/sign-in");
      notFound();
    }
    throw error;
  }

  return children;
}
