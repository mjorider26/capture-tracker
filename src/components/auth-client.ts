import { createAuthClient } from "better-auth/react";

// Keep browser authentication requests on the same-origin handler mounted by
// src/app/api/auth/[...all]/route.ts. Better Auth appends endpoint paths such
// as /sign-out to this base path and manages the session lifecycle itself.
export const authClient = createAuthClient({
  basePath: "/api/auth",
});
