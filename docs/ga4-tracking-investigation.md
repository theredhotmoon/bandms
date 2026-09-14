# GA4 tracking investigation — the silent tag

**Status: unresolved, escalated to Google Support.** Not a code problem — see the
evidence below. This doc is the record of what was tried, kept so nobody
re-runs the same diagnosis from scratch, and so the ready-to-send support
report doesn't get lost.

**Opened:** 2026-09-11. **Last update:** 2026-09-14.

## TL;DR

Both `gtag.js` and Google Tag Manager load and initialize correctly on the
live site, but neither ever attempts to send a single measurement hit —
reproduced identically across two independently-created GA4 properties, two
delivery mechanisms, two browsers on two networks, and even with Google's own
unmodified snippet. A hand-built request to Google's collection endpoint
*does* succeed and gets recorded, proving the account can receive data. The
failure is isolated to Google's own client-side tag logic deciding, every
time, not to try.

---

## Fixed along the way

None of these turned out to be the cause — but all three were real, live
bugs, and all three shipped.

| | |
|---|---|
| **Wrong domain in production `robots.txt`** | A scaffolding placeholder (`skanking-storks.com`, a domain that doesn't resolve) was served verbatim to every crawler. Swept from config, docs, and the live file. — PR #94 |
| **Site was HTTP-only** | `SITE_ADDRESS` had never moved off its `:80` default — no certificate, no secure context. A genuine, unrelated cookie-security bug, now serving real HTTPS. — PR #95 |
| **Consent withdrawal didn't stop tracking** | Rejecting cookies after a prior Accept left an already-loaded tag running. Now disables GA and clears its cookies immediately on withdrawal. — PR #91 |

---

## What was actually tested

Every variable that could plausibly explain a silent tag, each isolated and
tested independently, live, on production.

| Variable | What was compared | Result |
|---|---|---|
| Property | Original `G-W9V28TDT0E` vs. a brand-new one, `G-XEJZ271GEV` | **Identical** |
| Delivery mechanism | Direct `gtag.js` vs. Google Tag Manager (`GTM-TJGHRSXV`) | **Identical** |
| Consent architecture | Site's own consent-gated code vs. Google's literal, unmodified snippet with zero gating | **Identical** |
| Consent signals | No consent commands at all vs. a full `consent default` → `update: granted` sequence | **Identical** |
| Protocol | Plain HTTP vs. HTTPS with a valid Let's Encrypt certificate | **Identical** |
| Environment | Automated browser (sandboxed) vs. real browser, two separate home/work networks | **Identical** |
| Endpoint reachability | A hand-crafted raw request straight to `google-analytics.com/g/collect` | **Succeeded — recorded** |

That last row is what rules out "the account is entirely broken": Google's
servers can and do accept and store a hit when one actually reaches them.
It's specifically the client-side tag machinery — `gtag.js` and GTM's engine
too — that decides, every time, not to even attempt sending one.

---

## Diagnostic trail

- **Sep 11** — GA4 shipped, consent-gated (nothing loads until a visitor
  accepts). Matched byte-for-byte against Google's own snippet by pulling the
  live compiled JS off the server.
- **Sep 11** — First real-browser DebugView check shows nothing. Rules out the
  sandboxed test browser as the cause — a real visitor sees the same silence.
- **Sep 12** — Found the site was HTTP-only: `window.isSecureContext` was
  `false`, so Secure-flagged cookies (including GA4's own `_ga`) were being
  silently dropped. Real bug, shipped as PR #95. Hypothesis: this was the
  cause.
- **Sep 12** — HTTPS live — still silent. Re-tested the full Accept flow on
  the real, certificate-backed site. `gtag.js` initializes, processes its
  `config` command internally, and still never attempts a network call.
  Hypothesis ruled out.
- **Sep 13** — `sendBeacon`/`fetch`/`XMLHttpRequest` intercepted, all three
  patched before triggering the flow. None were called — not
  attempted-and-blocked, never attempted at all. The decision not to fire
  happens inside Google's own script.
- **Sep 13** — Fresh property created (`G-XEJZ271GEV`), zero history or
  config inherited from the original. Identical silence. Rules out anything
  specific to the original property.
- **Sep 13** — Literal Google snippet injected verbatim, bypassing every line
  this project wrote — no consent gating, no custom logic. Same result.
  Rules out this codebase entirely.
- **Sep 14** — Google Tag Manager tested (`GTM-TJGHRSXV`, GA4 Configuration
  tag, published). `gtm.js` loads and initializes; still zero send attempts.
  Rules out the delivery mechanism itself. **Escalated to Google Support.**

---

## Report for Google Support

Ready to paste — via Analytics' Help (`?`) icon → Contact us, or the public
Help Community if direct support isn't offered on this account tier.

> **GA4/GTM client-side tags never send hits, despite valid config and a
> confirmed-working endpoint.**
>
> Google tag (`gtag.js`) and Google Tag Manager both load and initialize
> without error, but never attempt to send a single measurement hit —
> reproduced consistently across two independently-created GA4 properties,
> two networks/browsers, and both delivery mechanisms.
>
> **Properties / containers involved**
> - GA4 property: `G-W9V28TDT0E`
> - GA4 property, freshly created to rule out property-specific config:
>   `G-XEJZ271GEV`
> - GTM container, freshly created — GA4 Configuration tag →
>   `G-XEJZ271GEV`, "All Pages" trigger, published: `GTM-TJGHRSXV`
> - Site: `https://skankingstorks.band` — valid HTTPS / Let's Encrypt,
>   confirmed secure context
>
> **What works**
> - A hand-crafted request directly to
>   `google-analytics.com/g/collect?v=2&tid=G-W9V28TDT0E&…` returns `204`
>   and **is recorded** — one event from this manual test is visible in
>   reporting.
>
> **What doesn't work — identical every time**
> - `googletagmanager.com/gtag/js?id=…` loads (200), executes, correctly
>   overrides `window.dataLayer.push` (confirmed via internal `gtm.dom`/
>   `gtm.load` events).
> - The queued `config` command is processed internally — then nothing. No
>   `sendBeacon`, `fetch`, or `XMLHttpRequest` call is ever made, verified by
>   intercepting all three before triggering the load and waiting 5+ seconds.
> - Identical result on the fresh property, with Google's completely
>   unmodified snippet and zero consent-gating, and routed through GTM
>   (`gtm.js` loads at 200, initializes, still never attempts a send).
> - No console errors at any point.
>
> **Also ruled out**
> - Consent Mode — tested with no signals at all, and with a full `default`
>   → `update: granted` sequence. No difference.
> - HTTP vs. HTTPS — reproduced identically before and after moving the site
>   to HTTPS.
> - A browser/extension/network blocker — reproduced on two unrelated
>   networks/browsers; interception confirms nothing is even attempted, not
>   attempted-then-blocked.
> - Account setup — Data Processing Terms and related account settings
>   confirmed accepted.
>
> Given a raw request to the same endpoint succeeds and is recorded, the
> properties/containers themselves appear functional. The issue is
> specifically that the client-side tag delivery code — both `gtag.js` and
> GTM — never attempts to transmit anything, on any property or container
> under this account.

---

## Technical reference

**Where the code lives:**

| File | Role |
|---|---|
| `web/src/lib/analytics.ts` | Load / disable GA4 |
| `web/src/stores/consent.ts` | Consent state, 6-month expiry |
| `web/src/components/ConsentBanner.vue` | Accept / Reject UI |
| `web/src/pages/[lang]/privacy.astro` | Privacy policy page |
| `.github/workflows/deploy.yml` | Deploy-managed secret sync |

**Deploy-managed secrets** (see `docs/deployment.md` for the full mechanism):

| Secret | Current value |
|---|---|
| `PUBLIC_GA_MEASUREMENT_ID` | synced to server `.env` on every push to `main` |
| `SITE_ADDRESS` | `skankingstorks.band, www.skankingstorks.band` |
| `APP_URL` / `FRONTEND_URL` / `APP_FRONTEND_URL` / `SITE_URL` | `https://skankingstorks.band` |

**Full write-up with evidence table and timeline, formatted:** [The Silent
Tag](https://claude.ai/code/artifact/26b58453-3c87-4d27-8701-9e6b1ecc1747)
(Artifact — private; share from its page if needed).

**Related PRs:** #91 (GA4 + SEO fixes), #92 (measurement-ID deploy sync), #94
(domain fix), #95 (HTTPS + URL vars deploy sync).
