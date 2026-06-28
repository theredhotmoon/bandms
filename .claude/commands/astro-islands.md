# SSR Public Site (Astro + Vue Islands on a Headless CMS)

Plan or implement a server-rendered, SEO-first **public** website that sits in front
of an existing **Vue SPA + PHP/Laravel (headless CMS)** stack — without touching the
backend or the admin SPA. The public site is rendered to complete HTML by **Astro**,
reusing existing Vue components as **islands** and consuming the existing CMS API.

Use this when: the public site is content/marketing-driven, SEO matters, the backend
is already (or can be) a headless API, and you want to keep the admin SPA intact.
Do **not** use this for app-like authenticated surfaces (dashboards, editors) — those
stay as the SPA, or use Inertia SSR instead.

## Architecture (the contract)

```
PHP/Laravel  ── unchanged ──►  CMS JSON API (e.g. /cms/site?lang=) + /admin SPA + media
Astro (new app, e.g. web/)  ──►  fetches the API, renders HTML for /<locale>/... routes
Existing Vue SFCs           ──►  imported into .astro pages as hydrated islands
```

Laravel = data + admin. Astro = the public render layer. Clean decoupling is the whole
point — it keeps the skill portable and the backend untouched.

## Decide rendering mode first

- **SSG (default, prefer this)** — `output: 'static'`. Pages built at deploy; fetch CMS
  in frontmatter at build time. Rebuild on content publish via webhook. Fastest, cheapest,
  best SEO. Right for charity/marketing/docs sites where content changes infrequently.
- **On-demand SSR for specific routes** — keep `output: 'static'`, add an adapter
  (`@astrojs/node`/`vercel`/`cloudflare`), and mark only the routes that must be live with
  `export const prerender = false`. Use for stock/price/availability-style freshness.
- Don't make everything SSR "just in case" — it costs a running Node host and throws away
  the zero-JS, CDN-cached win.

## Implementation playbook

1. **Scaffold** alongside the existing apps (don't nest inside the SPA):
   ```
   npm create astro@latest web -- --template minimal --typescript strict
   cd web && npx astro add vue sitemap
   ```
   Tailwind v4: prefer **`@tailwindcss/postcss`** (a `postcss.config.mjs` with the
   plugin + `import './styles/global.css'` in the base layout). The `@tailwindcss/vite`
   plugin is the documented path but on Astro 6 (rolldown-vite) it currently throws
   `Missing field 'tsconfigPaths'`; PostCSS avoids that coupling and produces the same
   output. (The old `@astrojs/tailwind` integration is deprecated for v4.)

2. **Config** (`astro.config.mjs`): set `site` (canonical origin, required for sitemap),
   `integrations: [vue(), sitemap()]`, and native i18n:
   ```js
   i18n: { defaultLocale: 'pl', locales: ['pl','en'],
           routing: { prefixDefaultLocale: false } }
   ```
   For remote CMS images add `image: { domains: ['cms.example.com'] }` (or `remotePatterns`).

3. **Typed CMS client** (`src/lib/cms.ts`): one `fetchSite(lang)` that calls the API and
   returns the existing `SiteContent` shape (copy the type from the SPA so they can't drift).
   Call it from `.astro` frontmatter with top-level `await`. For dynamic detail pages
   (blog/progress posts) use `getStaticPaths()` to enumerate slugs per locale at build.

4. **i18n routing** — create `src/pages/[...]` per locale (`index.astro`, `pl/`, etc.) so
   each language is a real, indexable URL. Do all content/string selection **server-side**
   in Astro and pass final strings down — don't ship vue-i18n into islands. Emit
   `<link rel="alternate" hreflang>` for every locale + `x-default`, and a canonical.

5. **Reuse Vue as islands** — import the SFC in a `.astro` file and hydrate selectively:
   - `client:visible` for below-the-fold widgets (accordion, gallery lightbox).
   - `client:idle` for chrome (lang switcher, sticky donate bar).
   - `client:load` only for above-the-fold interactivity.
   - `client:only="vue"` for components that truly can't SSR (browser-only APIs).
   Everything else renders as **static HTML** — no directive, no JS shipped.

6. **SEO layer** — a `<BaseHead>` component: title/description/canonical/OG/Twitter, robots,
   JSON-LD structured data (`Organization`/`NGO` site-wide, `Article` per post,
   `BreadcrumbList`). `@astrojs/sitemap` + a `public/robots.txt` pointing at it. Use
   `astro:assets` `<Image>` (with `inferSize` for remote CMS media) for responsive,
   optimized images.

7. **Rebuild trigger** (SSG) — on CMS publish/save, the backend fires a webhook to the
   host's deploy hook (or CI) to rebuild & redeploy. Document this; it's the one piece of
   backend glue. (One additive Laravel hook on save — still no change to existing endpoints.)

## Island pitfalls (the parts that bite)

- **Islands are isolated** — no shared Vue app instance. `provide/inject`, Pinia,
  vue-router, vue-i18n, and a TanStack `useSiteContent()` do **not** cross island
  boundaries. Decouple components to take **props** instead of those globals.
- **Cross-island shared state** (e.g. any "open donate modal" button must open one modal):
  use **`nanostores` + `@nanostores/vue`** (framework-agnostic, shared across islands), or
  wrap the interactive region in a single parent island.
- **Replace router links** with plain `<a href>` to Astro routes (locale-prefixed).
- **Props must be JSON-serializable** — they're serialized into HTML for hydration. No
  functions, class instances, or refs as props.
- **Don't fetch in islands** for first paint — fetch server-side in `.astro`, pass data in.
  Client fetches are fine only for post-load interactions.
- **Hydration mismatch**: keep the island's SSR output deterministic (no `Date.now()`,
  `Math.random()`, or `window` reads during render).

## Verify before shipping

- View-source shows full content HTML (not an empty `<div id="app">`) for each locale URL.
- `client:*` directives only on genuinely interactive components; check the network tab
  ships near-zero JS on static sections.
- Lighthouse SEO ~100; valid sitemap.xml; hreflang + canonical present and correct.
- Structured data passes Google's Rich Results test.
- Cross-island interaction (e.g. donate modal) works from every trigger.

Plan or implement for: $ARGUMENTS
