import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trackUsage } from "@/lib/auth/index";
import { AI_FIX_SYSTEM_PROMPT } from "@/lib/ai/prompts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RequestSchema = z.object({
  tracks: z.array(z.record(z.string(), z.string())),
  results: z.array(
    z.object({
      rule: z.string(),
      field: z.string(),
      trackIndex: z.number().optional(),
      severity: z.enum(["critical", "warning", "suggestion"]),
      message: z.string(),
      suggestion: z.string().optional(),
      fixable: z.boolean(),
    })
  ),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  // Gate behind Pro tier
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("tier, clerk_id")
    .eq("clerk_id", userId)
    .single();

  if (!user || (user.tier !== "pro" && user.tier !== "team")) {
    return Response.json(
      { data: null, error: "AI suggestions require a Pro or Label plan. Upgrade in Settings." },
      { status: 403 }
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.message }, { status: 400 });
  }

  const { tracks, results } = parsed.data;

  // Track AI usage
  await trackUsage(userId, "ai_call");

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: AI_FIX_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here are the tracks and their validation issues. Suggest fixes:\n\nTRACKS:\n${JSON.stringify(tracks, null, 2)}\n\nVALIDATION ISSUES:\n${JSON.stringify(results, null, 2)}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    let fixes: unknown[];
    try {
      const json = JSON.parse(text);
      fixes = Array.isArray(json.fixes) ? json.fixes : [];
    } catch {
      return Response.json({ data: null, error: "AI returned malformed response" }, { status: 502 });
    }

    return Response.json({ data: { fixes }, error: null });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return Response.json({ data: null, error: "AI service error. Please try again." }, { status: 502 });
  }
}
