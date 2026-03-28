import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canValidate, trackUsage } from "@/lib/auth";

const ReleaseSchema = z.object({
  title: z.string().min(1),
  artist: z.string().optional(),
  track_count: z.number().int().min(1),
  grade: z.string().optional(),
  critical_count: z.number().int().min(0).default(0),
  warning_count: z.number().int().min(0).default(0),
  suggestion_count: z.number().int().min(0).default(0),
  tracks: z.array(z.record(z.string(), z.string())),
  results: z.array(z.record(z.string(), z.unknown())),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  // Check tier limit
  if (!(await canValidate(userId))) {
    return Response.json(
      { data: null, error: "Monthly validation limit reached. Upgrade to Pro for unlimited validations." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ReleaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.message }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("releases")
    .insert({ ...parsed.data, clerk_id: userId })
    .select("id")
    .single();

  if (error) {
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }

  // Track usage
  await trackUsage(userId, "validation");

  return Response.json({ data, error: null }, { status: 201 });
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);

  const { data, error } = await supabaseAdmin
    .from("releases")
    .select("id, title, artist, grade, track_count, created_at, critical_count, warning_count, suggestion_count")
    .eq("clerk_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 });
  return Response.json({ data, error: null });
}
