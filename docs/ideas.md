# Ideas for future development

Generated 2026-06-19 based on a review of the current feature set.

---

## 1. Open Graph / SEO meta tags

**Priority: High — ~1 day**

Every page sets `document.title` but nothing sets `<meta property="og:*">`. When the band shares a concert or release link on Instagram/Facebook it shows a blank preview.

- `og:title`, `og:description`, `og:image`, `og:url` on every public route
- `<meta name="description">` per page
- Structured data (`application/ld+json`) for concerts (Google event cards in search results) and releases (MusicAlbum schema)

---

## 2. Newsletter broadcasting

**Priority: High — ~2–3 days**

Subscriber management and double opt-in are in place but the admin has no "compose & send" flow yet. Natural next step: write a subject + body in the admin, preview it, send to all confirmed subscribers.

- Compose + preview UI in the Newsletter admin
- Queue-based sending (Laravel mail queue)
- Delivery via Mailgun or similar

---

## 3. Photo albums / press pack

**Priority: Medium — ~2 days**

The album concept exists in the DB (E2E tests skip "photo album" tests when no albums are present) but the UI may be incomplete. Press photographers and promoters expect hi-res photos grouped by shoot.

- Finish album CRUD in the Photos admin
- Group photos by album on the public Gallery page
- Downloadable press pack (zip of hi-res) linked from the EPK page

---

## Honourable mention: Hetzner deployment

`docs/hetzner-deployment.md` exists but the file is untracked. If the app is not yet live, deployment leapfrogs all of the above in priority.
