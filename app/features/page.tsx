import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { Reveal } from "../_components/Reveal";
import { SiteNav } from "../_components/SiteNav";
import { SiteFooter } from "../_components/SiteFooter";
import {
  IconFingerprint, IconPen, IconType, IconClapper, IconRobot, IconSparkles,
  IconCalendar, IconCheckShield, IconClock, IconSliders, IconGrid, IconNote,
  IconArrowRight, IconCheck, IconLock,
} from "../_components/icons";

export const metadata: Metadata = {
  title: "Features — every metadata check MetaCheck runs",
  description:
    "The full breakdown of MetaCheck's 60+ validation rules: ISRC & UPC integrity, credits & splits, title formatting, artwork QC, Sync-Ready scoring, AI-disclosure, distributor profiles, and one-click AI fixes.",
  alternates: { canonical: `${SITE_URL}/features` },
  openGraph: {
    title: "Features — every metadata check MetaCheck runs",
    description:
      "60+ validation rules across rights, credits, formatting, discovery, artwork, and licensing — with one-click AI fixes.",
    url: `${SITE_URL}/features`,
  },
};

// The six headline capabilities (the detail that used to live on the landing page).
const CAPABILITIES = [
  {
    Icon: IconFingerprint,
    title: "ISRC & UPC integrity",
    cat: "Rights",
    desc: "Catches invalid formats, missing codes, duplicate ISRCs, and the classic ISRC↔UPC swap. Verifies the UPC GS1 check digit so your release tracks — and pays — on every platform.",
  },
  {
    Icon: IconPen,
    title: "Credits & splits",
    cat: "Royalties",
    desc: "Flags missing writers and producers, rejects placeholder credits (TBD / N/A), validates ISWC format, and enforces writer splits that total exactly 100% — so the MLC and your PRO can actually pay you.",
  },
  {
    Icon: IconType,
    title: "Title & formatting linter",
    cat: "Distributor QC",
    desc: "Catches wrong “feat.” / “ft.” syntax, ALL-CAPS titles, version tags outside brackets, decorative emoji, unbalanced brackets, keyword stuffing, and banned promo/store words that trigger instant rejection — and one-click-fixes the common ones.",
  },
  {
    Icon: IconClapper,
    title: "Sync-Ready score",
    cat: "Licensing",
    desc: "Scores 0–100 how licensable a track is for film & TV across three axes — clearable, usable, discoverable. Checks one-stop clearance, instrumental/clean versions, and the BPM, key, and mood tags supervisors search by.",
  },
  {
    Icon: IconRobot,
    title: "AI-disclosure check",
    cat: "2026",
    desc: "Every distributor treats AI-assisted music differently — CD Baby bans it, TuneCore restricts it, others want disclosure. MetaCheck flags where your disclosure will get a release banned vs. shipped, before you submit.",
  },
  {
    Icon: IconSparkles,
    title: "One-click AI fixes",
    cat: "Pro",
    desc: "Auto-corrects casing, writes proper ℗/© copyright lines, suggests genres, and fixes featured-artist formatting. Review each change, apply with one click, and export clean files.",
  },
];

// The full rule taxonomy — grouped so “60+ rules” reads as concrete coverage.
const RULE_GROUPS = [
  {
    Icon: IconFingerprint,
    group: "Rights & identifiers",
    rules: [
      "ISRC format & presence",
      "Duplicate ISRC detection",
      "ISRC ↔ UPC swap detection",
      "UPC GS1 check-digit validation",
    ],
  },
  {
    Icon: IconNote,
    group: "Credits & publishing",
    rules: [
      "Missing songwriter / producer credits",
      "Writer splits must total 100%",
      "ISWC format & presence",
      "Placeholder credits (TBD / N/A) — Apple-critical",
      "MLC, PRO & SoundExchange reminders",
    ],
  },
  {
    Icon: IconType,
    group: "Titles & formatting",
    rules: [
      "feat. / ft. / featuring syntax",
      "ALL-CAPS titles & casing-only artist names",
      "Version descriptors must be bracketed",
      "Banned promo / store words & URLs",
      "Emoji & decorative-unicode detection",
      "Bracket balance & trailing whitespace",
      "Keyword-stuffing detection",
    ],
  },
  {
    Icon: IconSliders,
    group: "Genre & discovery",
    rules: [
      "Missing or blank genre",
      "Generic / vague genre flag",
    ],
  },
  {
    Icon: IconCalendar,
    group: "Release date & timing",
    rules: [
      "Missing or invalid release date",
      "Same-day / too-soon submission",
      "Spotify editorial pitch window (review-lead aware)",
    ],
  },
  {
    Icon: IconClock,
    group: "Audio, language & compliance",
    rules: [
      "Sub-30s / royalty-farming duration",
      "Functional-length warnings",
      "Explicit flag ↔ profanity mismatch",
      "Language & character-set checks",
      "AI-disclosure vs. distributor policy",
    ],
  },
];

// Higher-level capabilities beyond the per-track rules.
const PLATFORM = [
  {
    Icon: IconCheckShield,
    title: "Artwork QC",
    desc: "Square, ≥3000×3000, JPG/PNG, and true CMYK detection by reading the JPEG marker — plus an opt-in OCR scan that flags forbidden URLs, @handles, emails, and dates baked into your cover. Runs entirely in your browser.",
  },
  {
    Icon: IconSliders,
    title: "Distributor profiles",
    desc: "DistroKid, CD Baby, TuneCore, Apple, or generic — each profile retunes which checks are critical vs. informational, so you validate against the exact bar your distributor sets.",
  },
  {
    Icon: IconGrid,
    title: "Batch / catalog mode",
    desc: "Drop a flat CSV of your whole catalog and MetaCheck groups it into releases by album and grades each one separately — perfect for labels and back-catalog cleanups.",
  },
  {
    Icon: IconRobot,
    title: "AI Submission Readiness Brief",
    desc: "A plain-English verdict on whether your release is ready to ship — the money at risk, and the exact order to fix things in. Built for the moment before you hit submit.",
  },
];

export default function FeaturesPage() {
  return (
    <main>
      <SiteNav />

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="relative pt-36 pb-16 overflow-hidden">
        {/* eslint-disable-next-line react/forbid-dom-props */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(13,148,136,0.10) 0%, transparent 70%)" }} />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <p className="fade-up fade-up-1 eyebrow mb-4">Features</p>
          <h1 className="fade-up fade-up-2 font-display text-5xl md:text-6xl tracking-tight leading-[1.05] mb-6">
            Everything MetaCheck checks,<br />
            <span className="text-accent-bright">so nothing slips through.</span>
          </h1>
          <p className="fade-up fade-up-3 text-lg text-text-muted leading-relaxed max-w-xl mx-auto mb-9">
            Sixty-plus rules your distributor never tells you about — across rights, credits,
            formatting, discovery, artwork, and licensing. Every issue is graded by severity with an
            exact fix. Here&apos;s the full picture.
          </p>
          <div className="fade-up fade-up-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="press glow-teal inline-flex items-center gap-1.5 px-6 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-bright"
            >
              Check my release free <IconArrowRight size={16} />
            </Link>
            <Link href="/#demo" className="press inline-flex items-center gap-1.5 px-6 py-3 border border-border-bright rounded-xl text-sm font-medium text-text-muted hover:text-text hover:border-text-muted transition-colors">
              Try the live demo
            </Link>
          </div>
        </div>
      </section>

      {/* ── HEADLINE CAPABILITIES ───────────────────────── */}
      <section className="py-16 border-t border-border">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPABILITIES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 70}>
                <div className="lift group h-full rounded-2xl border border-border bg-bg-card p-6 hover:border-border-bright hover:bg-surface">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent-bright flex items-center justify-center mb-5 transition-colors group-hover:bg-accent/15">
                    <f.Icon size={22} />
                  </div>
                  <h3 className="font-semibold text-text mb-1">{f.title}</h3>
                  <p className="eyebrow mb-3">{f.cat}</p>
                  <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FULL RULE TAXONOMY ──────────────────────────── */}
      <section className="py-20 border-t border-border bg-bg-elevated/60">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="max-w-2xl mb-12">
            <p className="eyebrow mb-3">The full checklist</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-[1.05]">
              Every rule, grouped by what it protects.
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {RULE_GROUPS.map((g, i) => (
              <Reveal key={g.group} delay={(i % 3) * 70}>
                <div className="h-full rounded-2xl border border-border bg-bg-card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent-bright flex items-center justify-center shrink-0">
                      <g.Icon size={18} />
                    </div>
                    <h3 className="font-semibold text-text">{g.group}</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {g.rules.map((r) => (
                      <li key={r} className="flex items-start gap-2.5 text-sm text-text-muted leading-relaxed">
                        <IconCheck size={15} className="text-accent-bright mt-0.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLATFORM CAPABILITIES ───────────────────────── */}
      <section className="py-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="max-w-2xl mb-12">
            <p className="eyebrow mb-3">Beyond the rules</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-[1.05]">
              Built for real release workflows.
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4">
            {PLATFORM.map((p, i) => (
              <Reveal key={p.title} delay={(i % 2) * 80}>
                <div className="lift h-full rounded-2xl border border-border bg-bg-card p-7 hover:border-border-bright hover:bg-surface">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent-bright flex items-center justify-center mb-5">
                    <p.Icon size={22} />
                  </div>
                  <h3 className="font-semibold text-text text-lg mb-2">{p.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8">
            <p className="inline-flex items-center gap-2 text-xs text-text-dim">
              <IconLock size={13} /> The validation engine and artwork QC run 100% in your browser — your unreleased metadata never leaves your device.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="py-28 border-t border-border bg-bg-elevated/60">
        <Reveal className="mx-auto max-w-xl px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4 leading-[1.05]">
            Run all 60+ checks on your <span className="text-accent-bright">next release.</span>
          </h2>
          <p className="text-text-muted mb-9 max-w-md mx-auto">
            Free for three releases a month. No credit card. See exactly what your distributor would
            have bounced — in under two seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="press glow-teal inline-flex items-center gap-1.5 px-6 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-bright"
            >
              Check my release free <IconArrowRight size={16} />
            </Link>
            <Link href="/#demo" className="press inline-flex items-center gap-1.5 px-6 py-3 border border-border-bright rounded-xl text-sm font-medium text-text-muted hover:text-text hover:border-text-muted transition-colors">
              Try the live demo
            </Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  );
}
