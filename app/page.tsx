import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { LiveDemo } from "./demo";
import { Reveal } from "./_components/Reveal";
import { SiteNav } from "./_components/SiteNav";
import { SiteFooter } from "./_components/SiteFooter";
import {
  IconCheckShield, IconNote, IconClapper,
  IconArrowRight, IconArrowDown, IconCheck, IconLock,
} from "./_components/icons";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MetaCheck",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Scan music release metadata for ISRC errors, missing credits, and 60+ issues that cost royalties. AI suggests fixes before you submit to your distributor.",
  url: SITE_URL,
  publisher: { "@type": "Organization", name: "Overlook Strategy" },
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "9", priceCurrency: "USD" },
    { "@type": "Offer", name: "Label", price: "29", priceCurrency: "USD" },
  ],
};

// Three plain-language promises — the detail lives on /features.
const PILLARS = [
  {
    Icon: IconCheckShield,
    title: "Pass QC the first time",
    desc: "Stop bouncing releases off distributor review. MetaCheck catches the wrong codes, bad titles, and banned words that trigger a rejection — before you submit.",
  },
  {
    Icon: IconNote,
    title: "Keep the royalties you earn",
    desc: "A missing credit or an unregistered split sends your money to a black box you may never see. MetaCheck flags every gap so you actually get paid.",
  },
  {
    Icon: IconClapper,
    title: "Get heard — and licensed",
    desc: "Clean genres, the right release-date timing, and a Sync-Ready score that puts your music in front of playlist editors and film & TV supervisors.",
  },
];

// Stat blocks for the “what bad metadata costs you” section. Figures are public
// industry estimates (the MLC's reported unmatched royalties; SoundExchange's
// unclaimed-royalty range; distributor manual-review windows) — noted below.
const COST = [
  { stat: "$424M+", label: "in unmatched mechanical royalties sat in the MLC “black box” — songwriter money waiting to be claimed." },
  { stat: "15–20%", label: "of artist royalties go unclaimed each year because of metadata errors (SoundExchange estimate)." },
  { stat: "1–3 weeks", label: "lost to a single rejected release stuck in distributor review." },
];

export default function Home() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteNav />

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="relative pt-44 pb-28 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
        }} />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(13,148,136,0.10) 0%, transparent 70%)" }} />

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <div className="fade-up fade-up-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-bright bg-bg-card/60 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-bright pulse-soft" />
            <span className="text-xs text-text-muted tracking-wide">For independent artists &amp; labels</span>
          </div>

          <h1 className="fade-up fade-up-2 font-display text-6xl md:text-7xl lg:text-8xl leading-[0.95] mb-7">
            Release music<br />that <span className="text-accent-bright">gets paid.</span>
          </h1>

          <p className="fade-up fade-up-3 text-xl text-text-muted leading-relaxed max-w-lg mx-auto mb-10">
            MetaCheck catches the errors that get your tracks rejected — or quietly
            drain your royalties — before you hit submit.
          </p>

          <div className="fade-up fade-up-4 flex flex-wrap items-center justify-center gap-3 mb-6">
            <Link
              href="/sign-up"
              className="press glow-teal inline-flex items-center gap-1.5 px-6 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-bright"
            >
              Check my release free <IconArrowRight size={16} />
            </Link>
            <a href="#demo" className="press inline-flex items-center gap-1.5 px-6 py-3 border border-border-bright rounded-xl text-sm font-medium text-text-muted hover:text-text hover:border-text-muted transition-colors">
              Try the live demo <IconArrowDown size={16} />
            </a>
          </div>

          <p className="fade-up fade-up-5 inline-flex items-center gap-2 text-xs text-text-dim">
            <IconLock size={13} /> Runs in your browser · No credit card · Works with DistroKid, TuneCore &amp; CD Baby
          </p>
        </div>
      </section>

      {/* ── THE COST (why it matters) ───────────────────── */}
      <section className="border-y border-border bg-bg-elevated/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="eyebrow mb-3">Why it matters</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-[1.08] mb-4">
              The industry is sitting on a fortune in unpaid royalties.<br />
              <span className="text-accent-bright">A lot of it belongs to artists like you.</span>
            </h2>
            <p className="text-text-muted leading-relaxed">
              One misspelled name, one missing songwriter, one wrong code — and a stream can&apos;t be
              matched, so it can&apos;t be paid. The money piles up unclaimed, and eventually it&apos;s paid
              out by market share — mostly to the major publishers. MetaCheck helps make sure yours
              doesn&apos;t go missing in the first place.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-5">
            {COST.map((c, i) => (
              <Reveal key={c.stat} delay={i * 90}>
                <div className="h-full rounded-2xl border border-border bg-bg-card p-7 text-center">
                  <p className="nums font-display text-5xl text-accent-bright tracking-tight mb-3">{c.stat}</p>
                  <p className="text-sm text-text-muted leading-relaxed">{c.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="text-[11px] text-text-dim text-center mt-6 max-w-xl mx-auto leading-relaxed">
            Industry estimates: the MLC&apos;s reported unmatched royalties; SoundExchange&apos;s
            unclaimed-royalty range; distributor manual-review windows. Your numbers will vary —
            but the leak is real, and it&apos;s avoidable.
          </p>
        </div>
      </section>

      {/* ── LIVE DEMO ───────────────────────────────────── */}
      <section id="demo" className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="text-center mb-10">
            <p className="eyebrow mb-3">See it work</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4">Watch it catch real errors</h2>
            <p className="text-text-muted max-w-md mx-auto">
              This is the actual engine. Search any released song and watch it audit the metadata in real time.
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-text-dim mt-4">
              <IconLock size={13} /> The validation engine runs in your browser — your metadata only leaves your device if you ask for an AI fix or save a release.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <LiveDemo />
          </Reveal>
        </div>
      </section>

      {/* ── WHAT IT DOES FOR YOU (3 pillars → /features) ── */}
      <section className="py-24 border-t border-border bg-bg-elevated/60">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="eyebrow mb-3">What you get</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-[1.05]">
              Three things every release needs.<br />MetaCheck handles all three.
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="lift group h-full rounded-2xl border border-border bg-bg-card p-7 hover:border-border-bright hover:bg-surface">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent-bright flex items-center justify-center mb-5 transition-colors group-hover:bg-accent/15">
                    <p.Icon size={22} />
                  </div>
                  <h3 className="font-semibold text-text text-lg mb-2">{p.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="text-center mt-12">
            <Link
              href="/features"
              className="press inline-flex items-center gap-1.5 px-5 py-3 border border-border-bright rounded-xl text-sm font-medium text-text hover:border-text-muted transition-colors"
            >
              See everything it checks — all 60+ rules <IconArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────── */}
      <section className="py-24 border-t border-border">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="text-center mb-16">
            <p className="eyebrow mb-3">How it works</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">Three steps. Two seconds. Fewer rejections.</h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: "1", title: "Paste or upload", desc: "Enter tracks by hand, paste from a sheet, or drop your distributor CSV." },
              { step: "2", title: "Instant scan", desc: "60+ rules run in under two seconds, graded by severity with exact fixes." },
              { step: "3", title: "Fix & export", desc: "Apply AI fixes with one click and export a clean, distributor-ready file." },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 90} className="text-center md:text-left">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-accent/30 bg-accent/10 text-accent-bright font-display text-xl mb-5">
                  {s.step}
                </div>
                <h3 className="font-semibold text-text text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────── */}
      <section id="pricing" className="py-24 border-t border-border bg-bg-elevated/60">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="text-center mb-14">
            <p className="eyebrow mb-3">Pricing</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-3">Start free. Upgrade when you scale.</h2>
            <p className="text-text-muted">A single missed ISRC costs more than a year of Pro.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5 items-start">
            {[
              {
                name: "Free", price: "$0", interval: "",
                features: ["3 releases per month", "All 60+ validation rules", "1 AI fix per month", "Artwork checks", "Sync-Ready score", "CSV export"],
                cta: "Get started free", href: "/sign-up", highlight: false,
              },
              {
                name: "Pro", price: "$9", interval: "/mo · or $49/yr — save 55%",
                features: ["Unlimited releases", "One-click AI fixes", "Release history", "PDF reports", "Distributor profiles", "Priority support"],
                cta: "Start with Pro", href: "/sign-up?redirect_url=%2Fapi%2Fcheckout%3Ftier%3Dpro", highlight: true,
              },
              {
                name: "Label", price: "$29", interval: "/mo · or $290/yr — save 17%",
                features: ["Everything in Pro", "Batch / catalog mode", "5 team members", "API access", "Custom rules"],
                cta: "Start with Label", href: "/sign-up?redirect_url=%2Fapi%2Fcheckout%3Ftier%3Dteam", highlight: false,
              },
            ].map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <div className={`relative rounded-2xl p-7 flex flex-col h-full ${
                  t.highlight ? "gradient-border bg-bg-card glow-teal md:-mt-3 md:pb-10" : "border border-border bg-bg-card"
                }`}>
                  {t.highlight && (
                    <span className="absolute -top-3 left-6 bg-accent text-white text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-semibold text-text text-lg mb-1">{t.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-text">{t.price}</span>
                    {t.interval && <span className="text-sm text-text-dim">{t.interval}</span>}
                  </div>
                  <ul className="space-y-3 mb-7 flex-1">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-text-muted">
                        <IconCheck size={16} className="text-accent-bright mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={t.href}
                    className={`press block text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                      t.highlight ? "bg-accent text-white hover:bg-accent-bright"
                        : "border border-border-bright text-text-muted hover:text-text hover:border-text-dim"
                    }`}
                  >
                    {t.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────── */}
      <section id="get-started" className="py-28 border-t border-border">
        <Reveal className="mx-auto max-w-xl px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4 leading-[1.05]">
            Your next release deserves to <span className="text-accent-bright">get paid.</span>
          </h2>
          <p className="text-text-muted mb-9 max-w-md mx-auto">
            Check it in seconds. Catch the errors that cost you a release date or a
            royalty — before you ever hit submit.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="press glow-teal inline-flex items-center gap-1.5 px-6 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-bright"
            >
              Check my release free <IconArrowRight size={16} />
            </Link>
            <a href="#demo" className="press inline-flex items-center gap-1.5 px-6 py-3 border border-border-bright rounded-xl text-sm font-medium text-text-muted hover:text-text hover:border-text-muted transition-colors">
              Try the live demo <IconArrowDown size={16} />
            </a>
          </div>
          <p className="text-xs text-text-dim mt-5">Free for 3 releases/month · No credit card required</p>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  );
}
