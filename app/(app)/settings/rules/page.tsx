import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getUserTier } from "@/lib/auth";
import { IconArrowRight } from "@/app/_components/icons";
import { RulesEditor } from "./_components/RulesEditor";

export const dynamic = "force-dynamic";

export default async function CustomRulesPage() {
  const { userId } = await auth();
  const tier = userId ? await getUserTier(userId) : "free";

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <p className="eyebrow mb-2">Label · Custom rules</p>
      <h1 className="font-display text-3xl tracking-tight text-text mb-2">Custom rules</h1>
      <p className="text-sm text-text-muted mb-8">
        Tune the validation engine to your label&apos;s standards. Changes apply to every release you check.
      </p>

      {tier !== "team" ? (
        <div className="rounded-xl border border-border bg-bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-text-muted flex-1">
            Custom rules are a <span className="text-text">Label-plan</span> feature.
          </p>
          <Link
            href="/settings"
            className="press shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors"
          >
            See plans <IconArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <RulesEditor />
      )}
    </div>
  );
}
