import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { getUserTier } from "@/lib/auth";
import { IconArrowRight } from "@/app/_components/icons";
import { SupportForm } from "./_components/SupportForm";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = { free: "Free", pro: "Pro", team: "Label" };

export default async function SupportPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const tier = userId ? await getUserTier(userId) : "free";
  const isPriority = tier === "pro" || tier === "team";

  // Soft SLA target — never a contractual guarantee. Copy stays honest about
  // what "priority" means (faster target, not a promise).
  const sla = isPriority
    ? "Priority queue — we aim to reply within 1 business day."
    : "We aim to reply within 2–3 business days.";

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <p className="eyebrow mb-2">Support</p>
      <h1 className="font-display text-3xl tracking-tight text-text mb-2">Get help</h1>
      <p className="text-sm text-text-muted mb-6">
        You&apos;re on the <span className="text-text font-medium">{TIER_LABEL[tier] ?? "Free"}</span> plan. {sla}
      </p>

      {!isPriority && (
        <div className="mb-6 rounded-xl border border-border bg-bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-text-muted flex-1">
            Pro &amp; Label get <span className="text-text">priority support</span> — your messages jump the queue.
          </p>
          <Link
            href="/settings"
            className="press shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent-bright text-sm font-semibold hover:bg-accent/20 transition-colors"
          >
            Upgrade <IconArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-border bg-bg-card p-6">
        <SupportForm defaultEmail={email} />
      </div>
    </div>
  );
}
