import { auth } from "@clerk/nextjs/server";
import { createPortalSession } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("stripe_customer_id")
    .eq("clerk_id", userId)
    .single();

  if (!userData?.stripe_customer_id) {
    return Response.json({ error: "No billing account found" }, { status: 404 });
  }

  const portalUrl = await createPortalSession(userData.stripe_customer_id);
  redirect(portalUrl);
}
