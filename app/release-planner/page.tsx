import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { SiteNav } from "../_components/SiteNav";
import { SiteFooter } from "../_components/SiteFooter";
import { ReleasePlanner } from "./ReleasePlanner";

export const metadata: Metadata = {
  title: "Free music release planner — timeline & deadline calculator",
  description:
    "Pick your release date and get the exact timeline — distributor submission, the Spotify editorial-pitch window, pre-saves, and promo — so you never miss a deadline. Free, no sign-up.",
  alternates: { canonical: `${SITE_URL}/release-planner` },
  openGraph: {
    title: "Free music release planner — timeline & deadline calculator",
    description:
      "Enter a release date, get every key deadline back-calculated — including the Spotify editorial-pitch window most artists miss.",
    url: `${SITE_URL}/release-planner`,
  },
};

export default function ReleasePlannerPage() {
  return (
    <main>
      <SiteNav />

      <section className="relative pt-36 pb-12 overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[480px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(13,148,136,0.10) 0%, transparent 70%)" }} />
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <p className="fade-up fade-up-1 eyebrow mb-4">Free tool</p>
          <h1 className="fade-up fade-up-2 font-display text-5xl md:text-6xl tracking-tight leading-[1.05] mb-6">
            Plan your release <span className="text-accent-bright">without missing a deadline.</span>
          </h1>
          <p className="fade-up fade-up-3 text-lg text-text-muted leading-relaxed mb-2">
            Pick your release date and we&apos;ll work backwards through every deadline that matters —
            including the Spotify editorial-pitch window most artists blow right past.
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-2xl px-6">
          <ReleasePlanner />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
