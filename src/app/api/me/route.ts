import { NextResponse } from "next/server";

import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const context = await requireBusinessContext();

    return NextResponse.json(
      {
        user: context.user,
        membership: context.membership,
        business: context.business,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    if (isAccessControlError(error)) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    console.error("Unexpected /api/me error:", error);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "The request could not be completed.",
        },
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
