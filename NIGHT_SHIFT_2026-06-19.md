# Night Shift — 19 June 2026

Run log for the overnight pass. Operator action items are in the chat reply, not here.

## TL;DR

Shipped to **live `main`** (auto-deployed, verified on `metacheck-ten.vercel.app`):
- Rewritten, simplified landing page (emotional pain + money hook, jargon stripped)
- New `/features` page absorbing all the detailed feature content
- New free `/release-planner` tool (client-side timeline calculator + lead-gen)
- Sitemap + shared nav/footer

Queued in **PR #7** (needs a signed-in click-through before merge):
- Five app-audit bug fixes (save/history consistency, stale save link, dead batch button, demo field mapping)
- New **Catalog Health Score** feature for batch/catalog mode

Everything built clean (`npm run build` ✓) and was visually verified where not auth-gated.

---

## 1. Research — musician pain points (landing copy basis)

The pain is emotional + financial, not technical:
- **Rejection limbo:** a flagged release sits 1–2 weeks in manual review; the full reject→fix→resubmit loop runs 1–3 weeks. Rejection emails are notoriously vague ("I don't know what's wrong").
- **Silently lost money:** MLC "black box" of unmatched royalties ≈ **$561M**, growing ~$9M/month; broader industry estimate ~$2.5B. Average loss ≈ **$15,500/artist**. One misspelled name or missing songwriter → the stream can't be matched → can't be paid. Splits that don't total 100% halt payment to *all* collaborators. After 3 years, unclaimed money is redistributed to the majors.
- **Emotional vocabulary:** "overwhelmed," "it feels like admin," "11pm-before-release panic," "you don't find out until after release, when it's too late." Identifier soup (ISRC/UPC/ISWC/IPI) intimidates.
- **Differentiator:** MetaCheck is distributor-*agnostic* and *preventive* — TuneCore/DistroKid checks only protect releases inside their own walls; DistroKid Fixer and black-box tools are reactive cleanup.

These drove the new landing copy: lead with "rejected — or unpaid," a "what bad metadata costs you" section with the real numbers, and benefit-led pillars.

## 2. Research — highest-demand next feature

Ranked recommendation (full detail from the research agent):
1. **Catalog Health Score** (BUILT, PR #7) — extends the existing batch engine; strongest willingness-to-pay (the "$X you're not positioned to collect" pitch); indie tier is unowned by competitors.
2. **Release timeline/checklist** (BUILT & LIVE as `/release-planner`) — client-side date math; real, recurring "can't-undo-it" pain (missed Spotify pitch window).
3. Split-sheet generator → free funnel feature, commoditized.
4. MLC/PRO registration → build as a *CWR exporter*, not an auto-submitter (no public write APIs).
5. AI metadata-from-audio → avoid; good free models are non-commercial-licensed (breaks the paid + client-side model).
6. Pre-save/smart-links → **do not build** (Spotify Feb-2026 API lockdown + DistroKid HyperFollow is free).

Two cheap high-authority wins (NOT yet built — see recommendations):
- Cite the distributor rulebook §number in each validation message (Spotify Style Guide V2.2, Apple Style Guide).
- Flag artificial-streaming risk (Spotify now charges €10/track/mo for flagged tracks).

## 3. App audit — full findings

Fixed in PR #7: save/history grade mismatch (#1/#2), stale `savedId` after fixes (#3), dead batch "Apply fix" button (#5), demo AI-fix field mapping + de-dup (#9/#10), batch profile-change wipe (#15).

**Not yet fixed (lower priority, recommend follow-up):**
- **#6** Title-case detector false-positives on legitimately stylized titles (e.g. "good Kid, m.A.A.d city"). Medium.
- **#7** Splits total can render ugly floats (e.g. `100.00000000000001%`). Use `toFixed(2)`. Low.
- **#11** `track_number_gaps` reuses one rule id for two different problems. Low.
- **#12** UPC check reports only the first bad UPC in a multi-track release (under-reports for catalogs). Medium.
- **#17** `language_charset_mismatch` false-positives on romaji titles with `ja` language. Low.
- **#18** Dashboard/history Supabase reads ignore the `error` field → a DB outage looks like "no releases." Low-medium.
- **#16** List keys use array index in the multi-track form (focus foot-gun if uncontrolled state is added). Low.

## 4. Decisions made

- **Hybrid deploy** (operator's choice): marketing/UI → live `main`; validate/history-touching changes → PR.
- Synced local `main` (was 10 commits stale) to `origin/main` before starting; the real product was already further along than the local checkout showed.
- Local build failure at start was just missing deps (`tesseract.js`, `@google/genai`, etc.) — fixed with `npm install`.
- Extracted shared `SiteNav`/`SiteFooter` and `lib/validation/fieldKeys.ts` to avoid duplication/drift.
- Did **not** ship engine-rule changes unattended (no ability to run the full behavioral test harness signed-out) — left as recommendations.

## 5. Verification

- `npm run build` ✓ after every change; pushed to `main` only after a clean build.
- Production landing + `/features` + `/release-planner` confirmed live via HTTP + content poll.
- Landing, `/features`, `/release-planner` visually screenshot-verified (desktop).
- Catalog Health scoring math verified with a standalone check.
- ⚠️ `/validate` and `/dashboard` are Clerk-gated; the batch UI + save/AI-fix flows could not be driven unattended — verify on the PR preview before merging.

## 6. Recommended next steps (in priority order)

1. Click through PR #7 batch mode + a save/AI-fix once, then merge.
2. Build the two quick wins: rulebook §citations in messages, artificial-streaming risk flag.
3. Work the remaining audit items (#12 and #18 first).
4. Consider promoting `/release-planner` (it's a strong SEO/lead surface) — link it from the hero or a nav slot, not just the footer.
