import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · MetaCheck",
  description: "The terms for using MetaCheck.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-accent-bright hover:underline">← MetaCheck</Link>
      <h1 className="font-display text-4xl text-text mt-6 mb-2 tracking-tight">Terms of Service</h1>
      <p className="text-text-dim text-sm mb-10">Last updated: June 2026</p>

      <div className="space-y-6 text-sm text-text-muted leading-relaxed">
        <p>
          By using MetaCheck (operated by Overlook Strategy) you agree to these terms. This is a
          starting template — have it reviewed by a lawyer before relying on it in production.
        </p>

        <section>
          <h2 className="text-text font-semibold mb-2">The service</h2>
          <p>
            MetaCheck validates music release metadata and suggests fixes. It is an assistive tool:
            it does not guarantee a release will be accepted by any distributor or streaming service.
            You are responsible for the final metadata you submit.
          </p>
        </section>

        <section>
          <h2 className="text-text font-semibold mb-2">Accounts &amp; acceptable use</h2>
          <p>
            Keep your login secure. Don&apos;t abuse the service, attempt to disrupt it, or use it to
            process metadata you don&apos;t have the rights to.
          </p>
        </section>

        <section>
          <h2 className="text-text font-semibold mb-2">Billing</h2>
          <p>
            Paid plans are billed monthly or annually via Stripe or PayPal until cancelled.
            One-time release credits are non-refundable once used. You can cancel anytime from
            Settings; access continues until the end of the paid period.
          </p>
        </section>

        <section>
          <h2 className="text-text font-semibold mb-2">No warranty</h2>
          <p>
            The service is provided &quot;as is&quot;, without warranties of any kind. To the extent
            permitted by law, Overlook Strategy is not liable for any indirect or consequential
            damages arising from your use of MetaCheck.
          </p>
        </section>

        <section>
          <h2 className="text-text font-semibold mb-2">Contact</h2>
          <p>
            Questions? <a href="mailto:hello@metacheck.app" className="text-accent-bright hover:underline">hello@metacheck.app</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
