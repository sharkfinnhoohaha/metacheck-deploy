import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { LiveDemo } from "./demo";
import { Reveal } from "./_components/Reveal";
import {
  IconFingerprint, IconPen, IconType, IconClapper, IconRobot, IconSparkles,
  IconArrowRight, IconArrowDown, IconCheck, IconLock,
} from "./_components/icons";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MetaCheck",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Scan music release metadata for ISRC errors, missing credits, and 40+ issues that cost royalties. AI suggests fixes before you submit to your distributor.",
  url: SITE_URL,
  publisher: { "@type": "Organization", name: "Overlook Strategy" },
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "9", priceCurrency: "USD" },
    { "@type": "Offer", name: "Label", price: "29", priceCurrency: "USD" },
  ],
};

const FEATURES = [
  {
    Icon: IconFingerprint,
    title: "ISRC & UPC integrity",
    cat: "Rights",
    desc: "Catches invalid formats, missing codes, and duplicate ISRCs that silently break royalty tracking across every platform.",
  },
  {
    Icon: IconPen,
    title: "Credits & splits",
    cat: "Royalties",
    desc: "Flags missing writers and producers, and enforces writer splits that total 100% — so the MLC and your PRO can actually pay you.",
  },
  {
    Icon: IconType,
    title: "Title & formatting linter",
    cat: "Distributor QC",
    desc: "Fixes wrong “feat.” syntax, ALL-CAPS titles, unbracketed versions, and banned words that trigger instant rejections.",
  },
  {
    Icon: IconClapper,
    title: "Sync-Ready score",
    cat: "New · Licensing",
    desc: "Scores how licensable a track is for film & TV — one-stop clearance, instrumental/clean versions, BPM, key and mood tags supervisors search by.",
  },
  {
    Icon: IconRobot,
    title: "AI-disclosure check",
    cat: "New · 2026",
    desc: "Each distributor treats AI music differently. MetaCheck flags where your disclosure will get a release banned vs. shipped — before you submit.",
  },
  {
    Icon: IconSparkles,
    title: "One-click AI fixes",
    cat: "Pro",
    desc: "Auto-corrects casing, writes copyright lines, suggests genres and fixes featured-artist formatting. Review, apply, export clean files.",
  },
];

const OUTCOMES = [
  { stat: "Pass QC the first time", desc: "Stop bouncing releases off distributor review. Fix every rejection trigger before you hit submit." },
  { stat: "Keep the royalties you earn", desc: "Missing credits and unregistered splits send your money to the MLC black box. MetaCheck catches them." },
  { stat: "Get discovered", desc: "Editorial-pitch timing, clean genres, and a sync-ready score that puts your music in front of playlists and supervisors." },
];

export default function Home() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/70 bg-bg/60 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white text-sm font-mono font-bold">M</span>
            </div>
            <span className="font-display text-xl text-text tracking-tight">MetaCheck</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden sm:block text-sm text-text-muted hover:text-text transition-colors px-3 py-2 rounded-lg">Features</a>
            <a href="#demo" className="hidden sm:block text-sm text-text-muted hover:text-text transition-colors px-3 py-2 rounded-lg">Demo</a>
            <a href="#pricing" className="hidden sm:block text-sm text-text-muted hover:text-text transition-colors px-3 py-2 rounded-lg">Pricing</a>
            <Link href="/sign-in" className="text-sm text-text-muted hover:text-text transition-colors px-3 py-2 rounded-lg">Sign in</Link>
            <Link
              href="/dashboard"
              className="press inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-bright"
            >
              Open app <IconArrowRight size={15} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="relative pt-36 pb-20 overflow-hidden">
        {/* eslint-disable-next-line react/forbid-dom-props */}
        <div className="absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
        }} />
        {/* eslint-disable-next-line react/forbid-dom-props */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(13,148,136,0.10) 0%, transparent 70%)" }} />

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <div className="fade-up fade-up-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-bright bg-bg-card/60 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-bright pulse-soft" />
            <span className="text-xs text-text-muted tracking-wide">Metadata QC for independent artists &amp; labels</span>
          </div>

          <h1 className="fade-up fade-up-2 font-display text-5xl md:text-6xl lg:text-7xl leading-[1.02] tracking-tight mb-6">
            Release-ready metadata,<br />
            <span className="text-accent-bright">before you hit submit.</span>
          </h1>

          <p className="fade-up fade-up-3 text-lg text-text-muted leading-relaxed max-w-xl mx-auto mb-9">
            MetaCheck scans every track for the 40+ formatting, credit, and rights errors
            that get releases rejected or quietly drain your royalties — then fixes them in one click.
          </p>

          <div className="fade-up fade-up-4 flex flex-wrap items-center justify-center gap-3 mb-6">
            <Link
              href="/sign-up"
              className="press glow-teal inline-flex items-center gap-1.5 px-6 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-bright"
            >
              Start free <IconArrowRight size={16} />
            </Link>
            <a href="#demo" className="press inline-flex items-center gap-1.5 px-6 py-3 border border-border-bright rounded-xl text-sm font-medium text-text-muted hover:text-text hover:border-text-muted transition-colors">
              Try the live demo <IconArrowDown size={16} />
            </a>
          </div>

          <p className="fade-up fade-up-5 inline-flex items-center gap-2 text-xs text-text-dim">
            <IconLock size={13} /> Runs in your browser · No credit card · DistroKid, TuneCore &amp; CD Baby
          </p>
        </div>
      </section>

      {/* ── VALUE / OUTCOMES ────────────────────────────── */}
      <section className="border-y border-border bg-bg-elevated/60">
        <div className="mx-auto max-w-6xl px-6 py-16 grid md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden my-0">
          {OUTCOMES.map((o, i) => (
            <Reveal key={o.stat} delay={i * 80} className="bg-bg-elevated/60 p-8">
              <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent-bright flex items-center justify-center mb-4">
                <IconCheck size={18} />
              </div>
              <h3 className="font-display text-2xl tracking-tight mb-2">{o.stat}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{o.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── LIVE DEMO ───────────────────────────────────── */}
      <section id="demo" className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="text-center mb-10">
            <p className="text-sm text-accent-bright font-medium mb-3">Live demo</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4">See it catch real errors</h2>
            <p className="text-text-muted max-w-md mx-auto">
              This is the actual engine. Search any released song and watch it audit the metadata in real time.
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-text-dim mt-4">
              <IconLock size={13} /> Validation runs entirely in your browser — nothing leaves your device.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <LiveDemo />
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────── */}
      <section id="features" className="py-24 border-t border-border">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="max-w-2xl mb-14">
            <p className="text-sm text-accent-bright font-medium mb-3">What it catches</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-[1.05]">
              Forty-plus rules your distributor never tells you about.
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 70}>
                <div className="lift group h-full rounded-2xl border border-border bg-bg-card p-6 hover:border-border-bright hover:bg-surface">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent-bright flex items-center justify-center mb-5 transition-colors group-hover:bg-accent/15">
                    <f.Icon size={22} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-text">{f.title}</h3>
                  </div>
                  <p className="text-xs text-text-dim uppercase tracking-wider mb-3">{f.cat}</p>
                  <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────── */}
      <section className="py-24 border-t border-border bg-bg-elevated/60">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="text-center mb-16">
            <p className="text-sm text-accent-bright font-medium mb-3">How it works</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">Three steps. Two seconds. Zero rejections.</h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: "1", title: "Paste or upload", desc: "Enter tracks by hand, paste from a sheet, or drop your distributor CSV." },
              { step: "2", title: "Instant scan", desc: "40+ rules run in under two seconds, graded by severity with exact fixes." },
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
      <section id="pricing" className="py-24 border-t border-border">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="text-center mb-14">
            <p className="text-sm text-accent-bright font-medium mb-3">Pricing</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-3">Start free. Upgrade when you scale.</h2>
            <p className="text-text-muted">A single missed ISRC costs more than a year of Pro.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5 items-start">
            {[
              {
                name: "Free", price: "$0", interval: "",
                features: ["3 releases per month", "All 40+ validation rules", "Artwork checks", "Sync-Ready score", "CSV export"],
                cta: "Get started free", href: "/sign-up", highlight: false,
              },
              {
                name: "Pro", price: "$9", interval: "/mo · or $49/yr",
                features: ["Unlimited releases", "One-click AI fixes", "Release history", "PDF reports", "Distributor profiles", "Priority support"],
                cta: "Start with Pro", href: "/sign-up", highlight: true,
              },
              {
                name: "Label", price: "$29", interval: "/mo · or $290/yr",
                features: ["Everything in Pro", "Batch / catalog mode", "5 team members", "API access", "Custom rules"],
                cta: "Start with Label", href: "/sign-up", highlight: false,
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
      <section id="get-started" className="py-28 border-t border-border bg-bg-elevated/60">
        <Reveal className="mx-auto max-w-xl px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4 leading-[1.05]">
            Stop losing royalties to <span className="text-accent-bright">sloppy metadata.</span>
          </h2>
          <p className="text-text-muted mb-9 max-w-md mx-auto">
            Check your next release in seconds. Catch the errors that cost you a release date or a
            royalty before you ever hit submit.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="press glow-teal inline-flex items-center gap-1.5 px-6 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-bright"
            >
              Start free <IconArrowRight size={16} />
            </Link>
            <a href="#demo" className="press inline-flex items-center gap-1.5 px-6 py-3 border border-border-bright rounded-xl text-sm font-medium text-text-muted hover:text-text hover:border-text-muted transition-colors">
              Try the live demo <IconArrowDown size={16} />
            </a>
          </div>
          <p className="text-xs text-text-dim mt-5">Free for 3 releases/month · No credit card required</p>
        </Reveal>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-dim">
          <span>&copy; {new Date().getFullYear()} Overlook Strategy</span>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-text-muted transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-text-muted transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
