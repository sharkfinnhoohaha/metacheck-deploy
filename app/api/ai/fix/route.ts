import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { trackUsage } from "@/lib/auth/index";
import { AI_FIX_SYSTEM_PROMPT } from "@/lib/ai/prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const RequestSchema = z.object({
  tracks: z.array(z.record(z.string(), z.any())),
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
  
  // For the demo/prototype, we'll allow unauthenticated requests.
  // In a production app, you would strictly enforce this.
  // if (!userId) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

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

  // Track AI usage if logged in
  if (userId) {
    try {
      await trackUsage(userId, "ai_call");
    } catch (err) {
      console.warn("Usage tracking failed, proceeding anyway:", err);
    }
  }

  try {
    const prompt = `System Instructions: ${AI_FIX_SYSTEM_PROMPT}\n\nHere are the tracks and their validation issues. Suggest fixes:\n\nTRACKS:\n${JSON.stringify(tracks, null, 2)}\n\nVALIDATION ISSUES:\n${JSON.stringify(results, null, 2)}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Gemini might wrap JSON in markdown blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanText = jsonMatch ? jsonMatch[0] : text;

    let fixes: unknown[];
    try {
      const json = JSON.parse(cleanText);
      fixes = Array.isArray(json.fixes) ? json.fixes : [];
    } catch (err) {
      console.error("Malformed AI response:", text);
      return Response.json({ data: null, error: "AI returned malformed response" }, { status: 502 });
    }

    return Response.json({ data: { fixes }, error: null });
  } catch (err) {
    console.error("Gemini API error:", err);
    return Response.json({ data: null, error: "AI service error. Please try again." }, { status: 502 });
  }
}
