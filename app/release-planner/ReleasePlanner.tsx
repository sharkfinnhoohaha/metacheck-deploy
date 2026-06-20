"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconCheckShield, IconNote, IconUpload, IconClapper, IconCalendar,
  IconBolt, IconSparkles, IconCheck, IconClock, IconArrowRight,
} from "../_components/icons";

/**
 * Free, fully client-side release-timeline planner. Given a release date it
 * works out the key deadlines indie artists routinely miss — the Spotify
 * editorial-pitch window especially — and grades each by urgency. No auth,
 * nothing leaves the browser. Doubles as a lead-in to the validator.
 */

type Tag = "prep" | "metadata" | "submit" | "pitch" | "deadline" | "promo" | "release" | "post";

const TAG_STYLE: Record<Tag, { label: string; dot: string; chip: string }> = {
  prep:     { label: "Prep",       dot: "bg-blue-500",   chip: "bg-blue/10 text-blue" },
  metadata: { label: "Metadata",   dot: "bg-accent-bright", chip: "bg-accent/10 text-accent-bright" },
  submit:   { label: "Submit",     dot: "bg-accent-bright", chip: "bg-accent/10 text-accent-bright" },
  pitch:    { label: "Pitch",      dot: "bg-amber-500",  chip: "bg-amber/10 text-amber" },
  deadline: { label: "Hard deadline", dot: "bg-rose-500", chip: "bg-red/10 text-red" },
  promo:    { label: "Promo",      dot: "bg-blue-500",   chip: "bg-blue/10 text-blue" },
  release:  { label: "Release",    dot: "bg-green-500",  chip: "bg-green/10 text-green" },
  post:     { label: "After",      dot: "bg-blue-500",   chip: "bg-blue/10 text-blue" },
};

const MILESTONES: { offset: number; Icon: typeof IconCheck; title: string; desc: string; tag: Tag }[] = [
  { offset: -35, Icon: IconCheckShield, title: "Lock masters & artwork", tag: "prep",
    desc: "Final audio and a square ≥3000×3000 cover. Changes after this cascade into every deadline below." },
  { offset: -28, Icon: IconNote, title: "Finalize metadata, splits & credits", tag: "metadata",
    desc: "Agree writer splits (they must total 100%), confirm every credit and ISRC/UPC, and run MetaCheck so nothing gets your release bounced." },
  { offset: -21, Icon: IconUpload, title: "Submit to your distributor", tag: "submit",
    desc: "Two-to-three weeks out is the safe window — it clears distributor review and makes you eligible for an editorial pitch." },
  { offset: -14, Icon: IconSparkles, title: "Pitch to Spotify editorial — sweet spot", tag: "pitch",
    desc: "Spotify recommends pitching as early as possible. ~14 days out gives editors time to consider you for New Music Friday and algorithmic playlists." },
  { offset: -10, Icon: IconClapper, title: "Set up pre-save / smart link", tag: "promo",
    desc: "Spin up a pre-save or smart link and start collecting saves — they feed Spotify's Release Radar signal on day one." },
  { offset: -7, Icon: IconBolt, title: "Last chance to pitch Spotify", tag: "deadline",
    desc: "Hard minimum: a track must be pitched at least 7 days before release to be eligible for editorial consideration. Miss it and the window is gone for this release." },
  { offset: -7, Icon: IconClapper, title: "Announce the release", tag: "promo",
    desc: "Reveal the cover and date, open the pre-save, and start the countdown across your channels." },
  { offset: -2, Icon: IconClapper, title: "Schedule release-day content", tag: "promo",
    desc: "Queue your posts, stories, and any video assets so release day is hands-off." },
  { offset: 0, Icon: IconCalendar, title: "Release day", tag: "release",
    desc: "Check every link is live, update your artist profiles and bio links, and share the smart link everywhere." },
  { offset: 1, Icon: IconClapper, title: "Submit to playlists & pitch press", tag: "post",
    desc: "Send the live link to third-party and user-curated playlists and any blogs or curators on your list." },
  { offset: 7, Icon: IconClock, title: "Review week-one performance", tag: "post",
    desc: "Check your first-week saves, skips, and playlist adds — they shape how the algorithm treats the next release." },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

function relativeLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function ReleasePlanner() {
  // Default the release date to ~6 weeks out, set after mount to avoid any
  // server/client hydration mismatch on the date.
  const [releaseDate, setReleaseDate] = useState("");
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    const now = startOfDay(new Date());
    setToday(now);
    setReleaseDate(addDays(now, 42).toISOString().slice(0, 10));
  }, []);

  const plan = useMemo(() => {
    if (!releaseDate || !today) return null;
    const rd = startOfDay(new Date(releaseDate + "T00:00:00"));
    if (isNaN(rd.getTime())) return null;
    return MILESTONES.map((m) => {
      const date = addDays(rd, m.offset);
      const days = Math.round((startOfDay(date).getTime() - today.getTime()) / 86_400_000);
      const status: "past" | "today" | "soon" | "future" =
        days < 0 ? "past" : days === 0 ? "today" : days <= 3 ? "soon" : "future";
      return { ...m, date, days, status };
    });
  }, [releaseDate, today]);

  const daysToRelease =
    plan && today ? Math.round((startOfDay(new Date(releaseDate + "T00:00:00")).getTime() - today.getTime()) / 86_400_000) : null;

  // Pitch window health for the headline banner.
  const pitchHealth = useMemo(() => {
    if (daysToRelease == null) return null;
    if (daysToRelease < 0) return { tone: "past", msg: "This date is in the past — pick an upcoming release date." };
    if (daysToRelease < 7) return { tone: "bad", msg: `Only ${daysToRelease} days out — too late for a Spotify editorial pitch (needs 7+). You can still release, but you'll miss the editorial window.` };
    if (daysToRelease < 14) return { tone: "warn", msg: `${daysToRelease} days out — you can still pitch Spotify, but aim for 14+ days to give editors room.` };
    return { tone: "good", msg: `${daysToRelease} days out — you're in the sweet spot for an editorial pitch and a clean submission.` };
  }, [daysToRelease]);

  const toneClass: Record<string, string> = {
    good: "border-green/30 bg-green/5 text-green-400",
    warn: "border-amber/30 bg-amber/5 text-amber",
    bad: "border-red/30 bg-red/5 text-rose-400",
    past: "border-border-bright bg-bg-card text-text-muted",
  };

  return (
    <div>
      {/* Controls */}
      <div className="rounded-2xl border border-border bg-bg-card p-6 mb-8">
        <label htmlFor="rd" className="block text-sm font-medium text-text mb-2">
          When do you want to release?
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <input
            id="rd"
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            className="px-4 py-3 bg-bg border border-border-bright rounded-xl text-text focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
          />
          {daysToRelease != null && daysToRelease >= 0 && (
            <p className="text-sm text-text-muted">
              <span className="nums font-display text-2xl text-accent-bright mr-1">{daysToRelease}</span>
              days until release
            </p>
          )}
        </div>

        {pitchHealth && (
          <div className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-relaxed ${toneClass[pitchHealth.tone]}`}>
            {pitchHealth.msg}
          </div>
        )}
      </div>

      {/* Timeline */}
      {plan && (
        <ol className="relative">
          {/* vertical line */}
          <span aria-hidden className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
          {plan.map((m, i) => {
            const ts = TAG_STYLE[m.tag];
            const dimmed = m.status === "past";
            return (
              <li key={`${m.title}-${i}`} className="relative pl-14 pb-7 last:pb-0">
                <span
                  className={`absolute left-2 top-0.5 flex items-center justify-center w-9 h-9 rounded-full border ${
                    m.status === "today"
                      ? "border-accent bg-accent text-white"
                      : m.status === "soon"
                      ? "border-amber/40 bg-amber/10 text-amber"
                      : dimmed
                      ? "border-border bg-bg-card text-text-dim"
                      : "border-border-bright bg-bg-card text-accent-bright"
                  }`}
                >
                  {m.status === "past" ? <IconCheck size={16} /> : <m.Icon size={16} />}
                </span>

                <div className={`rounded-xl border p-4 transition-colors ${dimmed ? "border-border bg-bg-card/40 opacity-70" : "border-border bg-bg-card hover:border-border-bright"}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${ts.chip}`}>{ts.label}</span>
                    <span className="text-sm font-semibold text-text">{m.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2 text-xs text-text-dim nums">
                    <span className="text-text-muted">{fmt.format(m.date)}</span>
                    <span aria-hidden>·</span>
                    <span className={m.status === "soon" ? "text-amber" : m.status === "today" ? "text-accent-bright" : ""}>
                      {relativeLabel(m.days)}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">{m.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* CTA */}
      <div className="mt-10 rounded-2xl border border-border bg-bg-elevated/60 p-7 text-center">
        <h3 className="font-display text-2xl tracking-tight mb-2">
          Step one starts four weeks out: <span className="text-accent-bright">clean metadata.</span>
        </h3>
        <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
          The fastest way to blow this whole timeline is a rejected release. Run your tracks through
          MetaCheck before you submit — it&apos;s free for three releases a month.
        </p>
        <Link
          href="/sign-up"
          className="press glow-teal inline-flex items-center gap-1.5 px-6 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-bright"
        >
          Check my release free <IconArrowRight size={16} />
        </Link>
      </div>

      <p className="text-[11px] text-text-dim text-center mt-5">
        Timing reflects Spotify&apos;s editorial-pitch guidance (pitch 7+ days out; ~2 weeks recommended)
        and typical distributor review windows. Your distributor&apos;s exact lead time may differ.
      </p>
    </div>
  );
}
