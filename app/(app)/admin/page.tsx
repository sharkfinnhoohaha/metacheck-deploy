import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/auth/admin";
import { IconGrid, IconArrowRight } from "@/app/_components/icons";

export const dynamic = "force-dynamic";

const GRADE_CLASSES: Record<string, { text: string; bg: string }> = {
  A: { text: "text-green-500", bg: "bg-green-500/10" },
  B: { text: "text-lime-500", bg: "bg-lime-500/10" },
  C: { text: "text-yellow-500", bg: "bg-yellow-500/10" },
  D: { text: "text-orange-500", bg: "bg-orange-500/10" },
  F: { text: "text-rose-500", bg: "bg-rose-500/10" },
};

const TIER_LABEL: Record<string, string> = { free: "Free", pro: "Pro", team: "Label" };

export default async function AdminPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!isAdminUser(userId, email)) redirect("/dashboard");

  const month = new Date().toISOString().slice(0, 7);

  const [usersRes, usageRes, releasesCount, recentReleasesRes] = await Promise.all([
    supabaseAdmin.from("users").select("clerk_id, email, name, tier, credits, created_at").order("created_at", { ascending: false }),
    supabaseAdmin.from("usage").select("validations, ai_calls, month").eq("month", month),
    supabaseAdmin.from("releases").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("releases").select("title, artist, grade, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const users = usersRes.data ?? [];
  const totalUsers = users.length;
  const byTier = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.tier] = (acc[u.tier] ?? 0) + 1;
    return acc;
  }, {});
  const newThisMonth = users.filter((u) => (u.created_at ?? "").slice(0, 7) === month).length;
  const usage = usageRes.data ?? [];
  const validationsThisMonth = usage.reduce((s, u) => s + (u.validations ?? 0), 0);
  const aiCallsThisMonth = usage.reduce((s, u) => s + (u.ai_calls ?? 0), 0);
  const totalReleases = releasesCount.count ?? 0;
  const recentReleases = recentReleasesRes.data ?? [];
  const recentUsers = users.slice(0, 8);
  const mrr = (byTier.pro ?? 0) * 9 + (byTier.team ?? 0) * 29;
  const paidUsers = (byTier.pro ?? 0) + (byTier.team ?? 0);

  const kpis = [
    { label: "Total users", value: totalUsers.toString(), sub: `${newThisMonth} new this month` },
    { label: "Est. MRR", value: `$${mrr}`, sub: `${paidUsers} paying · ${byTier.pro ?? 0} Pro / ${byTier.team ?? 0} Label` },
    { label: "Validations (mo)", value: validationsThisMonth.toString(), sub: `${totalReleases} releases saved all-time` },
    { label: "AI calls (mo)", value: aiCallsThisMonth.toString(), sub: "draws your Vertex credit" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent-bright flex items-center justify-center"><IconGrid size={18} /></span>
        <div>
          <h1 className="font-display text-3xl text-text">Admin</h1>
          <p className="text-text-muted text-sm">Live overview of users, revenue, and AI usage.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-bg-card p-5">
            <p className="text-xs text-text-dim uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-3xl font-bold text-text">{k.value}</p>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tier breakdown */}
      <div className="rounded-2xl border border-border bg-bg-card p-5 mb-8">
        <p className="text-xs text-text-dim uppercase tracking-wider mb-3">Users by tier</p>
        <div className="flex flex-wrap gap-3">
          {(["free", "pro", "team"] as const).map((t) => (
            <div key={t} className="flex items-baseline gap-2 rounded-lg bg-surface/50 border border-border px-4 py-2">
              <span className="text-2xl font-bold text-text">{byTier[t] ?? 0}</span>
              <span className="text-sm text-text-muted">{TIER_LABEL[t]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Recent signups */}
        <div>
          <h2 className="text-xs text-text-dim uppercase tracking-widest mb-3">Recent signups</h2>
          {recentUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">No users yet.</div>
          ) : (
            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              {recentUsers.map((u, i) => (
                <div key={u.clerk_id} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-border" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text truncate">{u.name || u.email || u.clerk_id}</p>
                    <p className="text-xs text-text-dim truncate">{u.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${u.tier === "free" ? "border-border text-text-muted" : "border-accent/30 text-accent-bright bg-accent/5"}`}>
                    {TIER_LABEL[u.tier] ?? u.tier}
                  </span>
                  <span className="text-xs text-text-dim shrink-0 w-20 text-right">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent releases */}
        <div>
          <h2 className="text-xs text-text-dim uppercase tracking-widest mb-3">Recent releases validated</h2>
          {recentReleases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">No releases yet.</div>
          ) : (
            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              {recentReleases.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-border" : ""}`}>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-display shrink-0 ${GRADE_CLASSES[r.grade]?.bg ?? "bg-surface"} ${GRADE_CLASSES[r.grade]?.text ?? "text-text-muted"}`}>
                    {r.grade ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text truncate">{r.title}</p>
                    <p className="text-xs text-text-dim truncate">{r.artist}</p>
                  </div>
                  <span className="text-xs text-text-dim shrink-0">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* What to watch */}
      <div className="rounded-2xl border border-border bg-bg-elevated p-5">
        <h2 className="text-xs text-text-dim uppercase tracking-widest mb-3">What to watch</h2>
        <ul className="space-y-2.5 text-sm text-text-muted">
          <li className="flex gap-2.5"><IconArrowRight size={15} className="text-accent-bright mt-0.5 shrink-0" /><span><span className="text-text">AI / Vertex credit burn</span> — {aiCallsThisMonth} AI calls this month. Watch GCP Billing → Vertex AI for spend against the $300 credit.</span></li>
          <li className="flex gap-2.5"><IconArrowRight size={15} className="text-accent-bright mt-0.5 shrink-0" /><span><span className="text-text">Conversions</span> — {paidUsers} paying of {totalUsers} users. Free users get 1 AI fix/mo; that&apos;s the convert lever.</span></li>
          <li className="flex gap-2.5"><IconArrowRight size={15} className="text-accent-bright mt-0.5 shrink-0" /><span><span className="text-text">Webhooks</span> — confirm Clerk / Stripe / PayPal webhooks are firing (tiers + new users sync here). A stuck webhook shows as signups not appearing or tiers not updating.</span></li>
          <li className="flex gap-2.5"><IconArrowRight size={15} className="text-accent-bright mt-0.5 shrink-0" /><span><span className="text-text">Errors</span> — check Vercel runtime logs for spikes in 5xx on /api/* and rate-limit 429s.</span></li>
        </ul>
        <div className="flex flex-wrap gap-3 mt-4">
          <a href="https://vercel.com/sharkfinnhoohahas-projects/metacheck" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-text transition-colors">Vercel ↗</a>
          <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-text transition-colors">GCP Billing ↗</a>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-text transition-colors">Stripe ↗</a>
          <Link href="/dashboard" className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-text transition-colors">Back to app</Link>
        </div>
      </div>
    </div>
  );
}
