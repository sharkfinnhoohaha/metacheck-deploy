import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · MetaCheck",
  description: "How MetaCheck handles your data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-accent-bright hover:underline">← MetaCheck</Link>
      <h1 className="font-display text-4xl text-text mt-6 mb-2 tracking-tight">Privacy Policy</h1>
      <p className="text-text-dim text-sm mb-10">Last updated: June 2026</p>

      <div className="space-y-6 text-sm text-text-muted leading-relaxed">
        <p>
          MetaCheck (operated by Overlook Strategy) helps musicians validate release metadata. This
          policy explains what we collect and why. It is a starting point — have it reviewed by a
          lawyer before relying on it in production.
        </p>

        <section>
          <h2 className="text-text font-semibold mb-2">Validation runs in your browser</h2>
          <p>
            Core metadata validation runs entirely client-side. The metadata you type or paste into
            the validator is <span className="text-text">not sent to our servers</span> unless you
            explicitly save a release, request an AI fix, or run an artwork scan.
          </p>
        </section>

        <section>
          <h2 className="text-text font-semibold mb-2">What we store</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account info (name, email) via our auth provider, Clerk.</li>
            <li>Releases you choose to save, and monthly usage counts, in our database (Supabase).</li>
            <li>Billing status via Stripe and/or PayPal. We never see or store full card numbers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-text font-semibold mb-2">AI features</h2>
          <p>
            When you request an AI fix or readiness brief, the relevant release metadata is sent to
            Google&apos;s Gemini API to generate suggestions. We use paid Google AI tiers, under which
            Google does not use your content to train its models. Artwork QC — including the optional
            text scan — runs entirely in your browser; your cover image is never uploaded.
          </p>
        </section>

        <section>
          <h2 className="text-text font-semibold mb-2">Third parties</h2>
          <p>Clerk (auth), Supabase (database), Stripe &amp; PayPal (payments), Google Gemini (AI), and Vercel (hosting).</p>
        </section>

        <section>
          <h2 className="text-text font-semibold mb-2">Your choices</h2>
          <p>
            Deleting your account permanently removes your saved releases and all associated data.
            For requests, contact{" "}
            <a href="mailto:hello@metacheck.app" className="text-accent-bright hover:underline">hello@metacheck.app</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
