import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/prisma";
import { hashWorkerdPassword, verifyWorkerdPassword } from "@/lib/auth/workerd-password";

const baseURL = process.env.BETTER_AUTH_URL;
const secret = process.env.BETTER_AUTH_SECRET;

if (!baseURL) {
  throw new Error("BETTER_AUTH_URL is not configured.");
}

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is not configured.");
}

function createAuth({
  allowSignUp,
  autoSignIn = true,
}: {
  allowSignUp: boolean;
  autoSignIn?: boolean;
}) {
  return betterAuth({
    appName: "Capture Tracker",
    baseURL,
    trustedOrigins: [baseURL!],
    secret,

    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      autoSignIn,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      password: {
        hash: hashWorkerdPassword,
        verify: ({ hash, password }) => verifyWorkerdPassword(hash, password),
      },
    },

    user: {
      modelName: "User",
      fields: {
        name: "displayName",
      },
    },

    session: {
      modelName: "Session",
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      freshAge: 60 * 10,
    },

    account: {
      modelName: "Account",
    },

    verification: {
      modelName: "Verification",
      storeIdentifier: "hashed",
    },

    rateLimit: {
      enabled: true,
      window: 60,
      max: 20,
      customRules: {
        "/sign-in/email": {
          window: 60,
          max: 5,
        },
      },
    },

  });
}

// The normal Better Auth route remains closed to public registration.
export const auth = createAuth({ allowSignUp: false });

// This instance is called only by the invitation-gated staging route. It does
// It shares the public handler's Workerd-safe credential and origin settings,
// but is called only after invitation validation.
export const stagingPracticeAccountAuth = createAuth({
  allowSignUp: true,
  // This invitation-gated identity creator provisions an account only. The
  // normal public handler owns the subsequent email/password sign-in session.
  autoSignIn: false,
});
