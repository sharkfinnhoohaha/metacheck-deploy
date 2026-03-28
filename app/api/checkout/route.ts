import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { createCheckoutSession } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

const schema = z.enum(["pro", "team"]);

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.redirect(new URL("/sign-in", req.url));

  const url = new URL(req.url);
  const tier = schema.safeParse(url.searchParams.get("tier"));
  if (!tier.success) {
    return Response.redirect(new URL("/settings?error=invalid_tier", req.url));
  }

  const user = await currentUser();
  if (!user) return Response.redirect(new URL("/sign-in", req.url));

  const email = user.emailAddresses[0]?.emailAddress ?? "";

  // Ensure user exists in DB
  await supabaseAdmin.from("users").upsert(
    { clerk_id: userId, email, name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() },
    { onConflict: "clerk_id", ignoreDuplicates: false }
  );

  const checkoutUrl = await createCheckoutSession(userId, email, tier.data);
  redirect(checkoutUrl);
}
