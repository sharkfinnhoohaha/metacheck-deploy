import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/features",
  "/release-planner",
  "/pricing(.*)",
  "/privacy",
  "/terms",
  "/api/webhooks/(.*)",
  "/api/music/search(.*)",
  "/api/ai/fix(.*)",
  // Public API: authenticated by API key (Bearer) inside the route, NOT by a
  // Clerk session — must bypass Clerk's session protection or it 401s first.
  "/api/v1/(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
