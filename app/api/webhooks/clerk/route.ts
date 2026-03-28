import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ClerkUserPayload = {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
};

export async function POST(req: Request) {
  const body = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  let payload: { type: string; data: ClerkUserPayload };

  try {
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof payload;
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const { type, data } = payload;

  if (type === "user.created" || type === "user.updated") {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    );
    const email = primaryEmail?.email_address ?? "";
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ");

    const { error } = await supabaseAdmin.from("users").upsert(
      { clerk_id: data.id, email, name, tier: "free" },
      { onConflict: "clerk_id", ignoreDuplicates: false }
    );
    if (error) {
      console.error("Clerk webhook upsert error:", error);
      return Response.json({ error: "DB upsert failed" }, { status: 500 });
    }
  }

  if (type === "user.deleted") {
    const { error } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("clerk_id", data.id);
    if (error) {
      console.error("Clerk webhook delete error:", error);
      return Response.json({ error: "DB delete failed" }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
