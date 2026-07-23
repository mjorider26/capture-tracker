import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/prisma";

const baseURL = process.env.BETTER_AUTH_URL;
const secret = process.env.BETTER_AUTH_SECRET;

if (!baseURL) {
  throw new Error("BETTER_AUTH_URL is not configured.");
}

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is not configured.");
}

export const auth = betterAuth({
  appName: "Capture Tracker",
  baseURL,
  secret,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
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

  plugins: [nextCookies()],
});
