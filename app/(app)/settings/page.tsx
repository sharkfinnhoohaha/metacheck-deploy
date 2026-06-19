import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import { UpgradePlans } from "./_components/UpgradePlans";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();
  const user = await currentUser();
  const sp = await searchParams;
  const supabase = supabaseAdmin;

  const { data: userData } = await supabase
    .from("users")
    .select("tier, stripe_customer_id, paypal_subscription_id, email, credits")
    .eq("clerk_id", userId!)
    .single();

  const tier = userData?.tier ?? "free";
  const credits = userData?.credits ?? 0;
  const hasStripe = !!userData?.stripe_customer_id;
  const hasPaypal = !!userData?.paypal_subscription_id;

  // Status banner from checkout/cancel redirects
  let banner: { kind: "ok" | "err"; text: string } | null = null;
  if (sp.success === "1") banner = { kind: "ok", text: "You're upgraded — thanks! Your plan is now active." };
  else if (sp.credits === "1") banner = { kind: "ok", text: "Release credit added to your account." };
  else if (sp.paypal === "success") banner = { kind: "ok", text: "PayPal approved — your plan will activate momentarily." };
  else if (sp.error === "checkout_failed") banner = { kind: "err", text: "Couldn't start checkout. Please try again." };
  else if (sp.error === "invalid_tier") banner = { kind: "err", text: "That plan isn't available. Please pick a valid plan." };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-text mb-1">Settings</h1>
        <p className="text-text-muted text-sm">Manage your plan and account.</p>
      </div>

      {banner && (
        <div
          className={`mb-8 rounded-lg border px-4 py-3 text-sm ${
            banner.kind === "ok"
              ? "border-green/30 bg-green/10 text-green"
              : "border-red/30 bg-red/10 text-red"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Current plan */}
      <section className="mb-10">
        <h2 className="eyebrow mb-4">Current Plan</h2>
        <div className="rounded-xl border border-border bg-bg-card p-6 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold capitalize text-text">{tier}</p>
            <p className="text-sm text-text-muted">
              {tier === "free"
                ? "3 validations/month · No AI"
                : tier === "pro"
                  ? "Unlimited · 300 AI calls/month"
                  : "Unlimited · 1500 AI calls/month"}
            </p>
            {credits > 0 && (
              <p className="text-sm text-accent-bright mt-1 nums">
                {credits} release credit{credits === 1 ? "" : "s"} available
              </p>
            )}
          </div>
          {hasStripe && (
            <form action="/api/billing-portal" method="POST">
              <button
                type="submit"
                className="press px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-text hover:border-border-bright transition-colors"
              >
                Manage billing →
              </button>
            </form>
          )}
          {hasPaypal && !hasStripe && (
            <form action="/api/paypal/cancel" method="POST">
              <button
                type="submit"
                className="press px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-text hover:border-border-bright transition-colors"
              >
                Cancel PayPal subscription
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Upgrade options (free tier) */}
      {tier === "free" && (
        <section className="mb-10">
          <h2 className="eyebrow mb-4">Upgrade</h2>
          <UpgradePlans />

          {/* One-time per-release credit */}
          <div className="mt-4 rounded-xl border border-dashed border-border bg-bg-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-semibold text-text">Just one release?</h3>
              <p className="text-sm text-text-muted mt-1">
                Buy a single <span className="text-text">release credit</span> — unlock save, AI fixes and export
                for one release. No subscription.
              </p>
            </div>
            <Link
              href="/api/checkout?product=release_credit"
              prefetch={false}
              className="shrink-0 text-center px-5 py-2.5 rounded-lg border border-accent/40 bg-accent/10 text-accent-bright text-sm font-semibold hover:bg-accent/20 transition-colors"
            >
              Buy a release credit
            </Link>
          </div>
        </section>
      )}

      {/* Account */}
      <section>
        <h2 className="eyebrow mb-4">Account</h2>
        <div className="rounded-xl border border-border bg-bg-card p-6">
          <p className="text-sm text-text mb-1">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-sm text-text-muted mb-4">{user?.emailAddresses[0]?.emailAddress}</p>
          <a
            href="https://accounts.clerk.dev/user"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-bright hover:underline"
          >
            Manage account →
          </a>
        </div>
      </section>
    </div>
  );
}
