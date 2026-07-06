import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/api/((?!webhooks).*)",
    "/__clerk/:path*",
  ],
};
