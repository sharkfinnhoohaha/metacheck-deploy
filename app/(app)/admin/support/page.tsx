import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = { free: "Free", pro: "Pro", team: "Label" };

type Ticket = {
  id: string;
  email: string | null;
  subject: string;
  body: string;
  tier: string;
  priority: string;
  status: string;
  created_at: string;
};

export default async function AdminSupportPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!isAdminUser(userId, email)) redirect("/dashboard");

  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select("id, email, subject, body, tier, priority, status, created_at")
    .order("priority_rank", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(200);

  // Table not migrated yet → show a setup hint rather than crashing.
  const notReady = error?.code === "42P01" || error?.code === "PGRST205";
  const tickets = (data ?? []) as Ticket[];
  const open = tickets.filter((t) => t.status === "open");

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="eyebrow mb-2">Admin</p>
      <h1 className="font-display text-3xl tracking-tight text-text mb-1">Support inbox</h1>
      <p className="text-sm text-text-muted mb-6">{open.length} open · {tickets.length} total (priority first)</p>

      {notReady ? (
        <div className="rounded-xl border border-amber/20 bg-amber/5 p-5 text-sm text-text-muted">
          The <code className="text-text">support_tickets</code> table isn&apos;t set up yet. Run{" "}
          <code className="text-text">supabase/migrations/005_support.sql</code> to enable Support.
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-card p-8 text-center text-sm text-text-muted">
          No support messages yet.
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-bg-card p-5">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {t.priority === "priority" && (
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-accent/20 bg-accent/10 text-accent-bright">
                    Priority
                  </span>
                )}
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-text-muted">
                  {TIER_LABEL[t.tier] ?? t.tier}
                </span>
                {t.status !== "open" && (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-text-dim">
                    {t.status}
                  </span>
                )}
                <span className="text-xs text-text-dim ml-auto nums">{new Date(t.created_at).toLocaleString()}</span>
              </div>
              <p className="font-semibold text-text mb-1">{t.subject}</p>
              <p className="text-sm text-text-muted whitespace-pre-wrap mb-2">{t.body}</p>
              {t.email && (
                <a href={`mailto:${t.email}?subject=Re: ${encodeURIComponent(t.subject)}`} className="text-xs text-accent-bright hover:underline">
                  Reply to {t.email}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
