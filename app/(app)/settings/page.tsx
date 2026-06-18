import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

const PLANS = [
  {
    id: "pro",
    name: "Pro",
    price: "$9/mo",
    features: ["Unlimited validations", "300 AI fixes/month", "All 30+ rules", "PDF reports", "History"],
  },
  {
    id: "team",
    name: "Label",
    price: "$29/mo",
    features: ["Unlimited everything", "1500 AI fixes/month", "Team members", "API access", "Custom rules"],
  },
];

export default async function SettingsPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const supabase = supabaseAdmin;

  const { data: userData } = await supabase
    .from("users")
    .select("tier, stripe_customer_id, email")
    .eq("clerk_id", userId!)
    .single();

  const tier = userData?.tier ?? "free";
  const hasStripe = !!userData?.stripe_customer_id;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-text mb-1">Settings</h1>
        <p className="text-text-muted text-sm">Manage your plan and account.</p>
      </div>

      {/* Current plan */}
      <section className="mb-10">
        <h2 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-4">Current Plan</h2>
        <div className="rounded-xl border border-border bg-bg-card p-6 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold capitalize text-text">{tier}</p>
            <p className="text-sm text-text-muted">
              {tier === "free" ? "3 validations/month · No AI" : tier === "pro" ? "Unlimited · 300 AI calls/month" : "Unlimited · 1500 AI calls/month"}
            </p>
          </div>
          {hasStripe && (
            <form action="/api/billing-portal" method="POST">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted font-mono hover:text-text hover:border-border-bright transition-colors"
              >
                Manage billing →
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Upgrade options */}
      {tier === "free" && (
        <section className="mb-10">
          <h2 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-4">Upgrade</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-border bg-bg-card p-6 flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-text">{plan.name}</h3>
                    <span className="text-accent-bright font-mono text-sm">{plan.price}</span>
                  </div>
                  <ul className="space-y-1.5 mt-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-text-muted">
                        <span className="text-green text-xs">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  href={`/api/checkout?tier=${plan.id}`}
                  className="w-full text-center py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors"
                >
                  Upgrade to {plan.name}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Account */}
      <section>
        <h2 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-4">Account</h2>
        <div className="rounded-xl border border-border bg-bg-card p-6">
          <p className="text-sm text-text mb-1">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-sm text-text-muted mb-4 font-mono">
            {user?.emailAddresses[0]?.emailAddress}
          </p>
          <a
            href="https://accounts.clerk.dev/user"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-bright hover:underline font-mono"
          >
            Manage account →
          </a>
        </div>
      </section>
    </div>
  );
}
