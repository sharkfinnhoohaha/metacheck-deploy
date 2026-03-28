import Link from "next/link";
import { LiveDemo } from "./demo";

export default function Home() {
  return (
    <main>
      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
              <span className="text-white text-xs font-mono font-bold">M</span>
            </div>
            <span className="font-display text-lg text-text tracking-tight">MetaCheck</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-text-muted hover:text-text transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-text-muted hover:text-text transition-colors">Pricing</a>
            <a
              href="#waitlist"
              className="text-sm px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-bright transition-colors"
            >
              Join Waitlist
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="relative pt-32 pb-12 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }} />
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(13,148,136,0.08) 0%, transparent 70%)" }} />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <div className="fade-up fade-up-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/30 bg-accent-glow mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-bright pulse-soft" />
              <span className="text-xs font-mono text-accent-bright">Launching Soon — Free for Indie Artists</span>
            </div>

            <h1 className="fade-up fade-up-2 font-display text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
              Fix your metadata<br />
              <span className="text-accent-bright italic">before</span> your distributor<br />
              rejects it.
            </h1>

            <p className="fade-up fade-up-3 text-lg text-text-muted leading-relaxed max-w-xl mb-8">
              MetaCheck scans your release for ISRC errors, missing credits, bad formatting,
              and 30+ issues that cost you royalties. AI suggests fixes. Export clean files.
              Never get rejected again.
            </p>

            <div className="fade-up fade-up-4 flex flex-wrap items-center gap-4 mb-4">
              <a
                href="#waitlist"
                className="px-6 py-3 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-bright transition-colors glow-teal"
              >
                Join the Waitlist →
              </a>
              <a href="#demo" className="px-6 py-3 border border-border-bright rounded-lg text-sm font-medium text-text-muted hover:text-text hover:border-text-muted transition-colors">
                Try Live Demo ↓
              </a>
            </div>

            <p className="fade-up fade-up-5 text-xs text-text-dim font-mono">
              Free for 3 releases/month · No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────── */}
      <section className="border-y border-border bg-bg-elevated">
        <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "120K+", label: "songs uploaded to DSPs daily" },
            { value: "40%", label: "of ownership disputes avoidable with proper metadata" },
            { value: "30+", label: "validation rules" },
            { value: "<2s", label: "to scan a full release" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-accent-bright font-mono">{s.value}</p>
              <p className="text-xs text-text-dim mt-1 leading-relaxed">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE DEMO ───────────────────────────────────── */}
      <section id="demo" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-mono text-accent-bright uppercase tracking-widest mb-3">Live Demo</p>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-3">See it catch real errors</h2>
            <p className="text-text-muted max-w-md mx-auto text-sm">
              This is the actual validation engine. Click the sample tracks below or enter your own metadata.
            </p>
          </div>
          <LiveDemo />
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────── */}
      <section id="features" className="py-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-mono text-accent-bright uppercase tracking-widest mb-3">What It Catches</p>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight">
              30+ rules your distributor doesn&apos;t tell you about
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "⚡",
                title: "ISRC Validation",
                desc: "Catches invalid formats, missing codes, and duplicate ISRCs that silently kill your royalty tracking across every platform.",
                tag: "critical",
              },
              {
                icon: "✍️",
                title: "Credit Completeness",
                desc: "Flags missing songwriters, producers, and composers. No credits = no publishing royalties from PROs, MLC, or SoundExchange.",
                tag: "critical",
              },
              {
                icon: "🏷️",
                title: "Title Formatting",
                desc: 'Detects wrong "feat." syntax, ALL CAPS titles, version info outside parentheses, and trailing whitespace that triggers rejections.',
                tag: "warning",
              },
              {
                icon: "🎵",
                title: "Genre Matching",
                desc: "Validates against DSP-recognized genre lists. Wrong genres = wrong playlists = missed listeners.",
                tag: "suggestion",
              },
              {
                icon: "📅",
                title: "Release Date Logic",
                desc: "Warns when your date is too close for Spotify editorial pitch consideration (7-day minimum lead time).",
                tag: "warning",
              },
              {
                icon: "🤖",
                title: "AI Fix Suggestions",
                desc: "Auto-corrects title casing, generates copyright lines, suggests genre tags, and fixes featured artist formatting. One-click apply.",
                tag: "pro",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="gradient-border group rounded-2xl bg-bg-card p-6 hover:bg-surface transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-2xl">{f.icon}</span>
                  <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    f.tag === "critical" ? "bg-red/10 text-red" :
                    f.tag === "warning" ? "bg-amber/10 text-amber" :
                    f.tag === "pro" ? "bg-accent/10 text-accent-bright" :
                    "bg-blue/10 text-blue"
                  }`}>
                    {f.tag}
                  </span>
                </div>
                <h3 className="font-semibold text-text mb-2">{f.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────── */}
      <section className="py-20 border-t border-border bg-bg-elevated">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-mono text-accent-bright uppercase tracking-widest mb-3">Workflow</p>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight">Three steps. Two seconds. Zero rejections.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: "01", title: "Paste or upload", desc: "Enter track details manually, paste from a spreadsheet, or upload your distributor CSV." },
              { step: "02", title: "Instant scan", desc: "30+ rules run in under 2 seconds. Issues are graded by severity with specific fix instructions." },
              { step: "03", title: "Fix and export", desc: "Apply AI-suggested fixes with one click. Export a clean, distributor-ready file. Ship it." },
            ].map((s) => (
              <div key={s.step} className="relative">
                <span className="font-mono text-6xl font-bold text-border-bright/50 absolute -top-4 -left-2">{s.step}</span>
                <div className="relative pt-10">
                  <h3 className="font-semibold text-text text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────── */}
      <section id="pricing" className="py-20 border-t border-border">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-mono text-accent-bright uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-3">Start free. Upgrade when you need more.</h2>
            <p className="text-text-muted text-sm">A single missed ISRC costs more than a year of Pro.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Free",
                price: "$0",
                interval: "",
                features: ["3 releases per month", "15 validation rules", "CSV export", "Manual entry"],
                cta: "Get Started Free",
                highlight: false,
              },
              {
                name: "Pro",
                price: "$9",
                interval: "/month",
                features: ["Unlimited releases", "30+ validation rules", "AI fix suggestions", "CSV + DDEX import", "Release history", "Priority support"],
                cta: "Join Waitlist",
                highlight: true,
              },
              {
                name: "Label",
                price: "$29",
                interval: "/month",
                features: ["Everything in Pro", "5 team members", "Bulk validation", "API access", "Custom rules", "Dedicated support"],
                cta: "Contact Us",
                highlight: false,
              },
            ].map((t) => (
              <div
                key={t.name}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  t.highlight
                    ? "gradient-border bg-bg-card glow-teal"
                    : "border border-border bg-bg-card"
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-6 bg-accent text-white text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}

                <h3 className="font-semibold text-text text-lg mb-1">{t.name}</h3>
                <div className="flex items-baseline gap-0.5 mb-5">
                  <span className="text-4xl font-bold text-text font-mono">{t.price}</span>
                  {t.interval && <span className="text-sm text-text-dim">{t.interval}</span>}
                </div>

                <ul className="space-y-2.5 mb-7 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                      <span className="text-accent-bright mt-0.5 text-xs">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href="#waitlist"
                  className={`block text-center py-3 rounded-lg text-sm font-semibold transition-colors ${
                    t.highlight
                      ? "bg-accent text-white hover:bg-accent-bright"
                      : "border border-border-bright text-text-muted hover:text-text hover:border-text-dim"
                  }`}
                >
                  {t.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAITLIST CTA ────────────────────────────────── */}
      <section id="waitlist" className="py-20 border-t border-border bg-bg-elevated">
        <div className="mx-auto max-w-xl px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-3">
            Stop losing royalties to<br />
            <span className="text-accent-bright italic">sloppy metadata</span>
          </h2>
          <p className="text-text-muted text-sm mb-8 max-w-md mx-auto">
            Join the waitlist. We&apos;ll let you know when MetaCheck is live.
            Early signups get Pro free for the first month.
          </p>

          <form
            action="https://formspree.io/f/YOUR_FORM_ID"
            method="POST"
            className="flex gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              name="email"
              required
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 bg-bg-card border border-border-bright rounded-lg text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors font-mono"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-bright transition-colors whitespace-nowrap"
            >
              Join Waitlist
            </button>
          </form>

          <p className="text-[11px] text-text-dim mt-4 font-mono">No spam. Unsubscribe anytime.</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between text-xs text-text-dim font-mono">
          <span>&copy; {new Date().getFullYear()} Overlook Strategy</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-text-muted transition-colors">Terms</a>
            <a href="#" className="hover:text-text-muted transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
