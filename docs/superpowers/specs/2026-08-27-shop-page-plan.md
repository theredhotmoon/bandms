# Shop page — plan

**Date:** 2026-08-27
**Status:** planned, not built
**Scope:** public Astro site (`web/`) only.
**Design:** `Shop.html` + `variants/shop_page.jsx`, `variants/shop_shared.jsx` in
the Claude Design project `ec416ba8-dc11-4b7a-9648-25503de57abb`.

Deferred to last deliberately: Shop is the only remaining page that touches
checkout, so postponing it postpones the only real regression risk in the batch.

---

## 1. What needs porting

Two files, both still on the pre-theme Tailwind layout:

| File | Route | State |
|---|---|---|
| `components/sections/MerchSection.astro` | `/[lang]/{merch-slug}` | Not ported |
| `components/detail/MerchItemDetail.astro` | `/[lang]/{merch-slug}/{slug}` | Not ported |

Confirm with the audit that has held all along — a ported page has a scoped
`<style>` driven by `var(--font-display)` and no palette utilities:

```bash
grep -c 'var(--font-display)\|PageHero' web/src/components/sections/MerchSection.astro
grep -oE '\b(text|bg|border)-(zinc|gray|neutral)-[0-9]{2,3}|text-4xl|font-black|max-w-4xl' \
  web/src/components/detail/MerchItemDetail.astro | wc -l
```

---

## 2. Data — all of it already exists

No backend work is expected. Verified against `ShopItemResource`:

| Design concept | Source | Notes |
|---|---|---|
| Category tabs (All / Records / Apparel / Accessories) | `GET /shop-categories`, `item.categories` | The design hardcodes four; ours are CMS rows, so build tabs from the categories actually in use — the same rule the Gallery filter follows |
| Product grid | `GET /shop` | |
| Multi-currency price | `item.prices[] { currency, amount }` | `amount` is in minor units; the design formats `120 zł` and `€28` |
| Variants with per-variant stock | `item.variants` | |
| Presale + ship date | `is_presale`, `presale_ships_at` | |
| Stock states (in / low / sold out) | `stock_quantity`, `is_available` | Design shows three; pick thresholds explicitly rather than inferring |
| External purchase | `purchase_url` | Some items sell off-site |
| Photos | `item.photos[] { url, alt_text }` | Design shows a per-item count, so a gallery is expected on detail |
| Cross-links to a release | `item.release_ids` | Already consumed by the Music page's "Buy physical" |
| Cart, subtotal, checkout | `CartDrawer.vue`, `AddToCart.vue`, Stripe | **Restyle only** |

**One thing to check before starting:** the design carries a currency *switcher*
(`CURRENCIES = ['PLN', 'EUR']`, `shpCurrency`). Confirm whether the cart and
`CheckoutController` support choosing a currency, or whether they assume one. If
they assume one, the switcher is display-only and must not imply otherwise — or
it gets dropped. Do not ship a control that changes a label but not the charge.

---

## 3. Sections to build

From the `shp*` keys in `variants/shared.jsx`:

**List page**
1. Hero — use `PageHero` (kicker, title, lead)
2. Category tabs + currency control (see caveat above)
3. Product grid — cover, name, price from, variant count, stock/presale stamp
4. Empty state per category

**Detail page**
1. Breadcrumb
2. Photo gallery — several photos per item
3. Name, price, description
4. Variant picker (size, with per-variant stock and sold-out states)
5. Add to cart, or an outbound button when `purchase_url` is set
6. Presale note with ship date
7. Related — the release this item belongs to, gated on the releases module

**Reuse rather than rebuild:** `PageHero`, `SectionHead`, `ThemeSlot`,
`AddToCart.vue`, `CartDrawer.vue`, `CartIcon.vue`, `Icon.astro`, and the card
patterns from `ReleasesSection`/`PhotosSection`. The variant picker and gallery
are the only genuinely new UI.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| **Checkout regression.** This is the one page wired to Stripe | Restyle only — no changes to cart logic, totals or the checkout call. The existing shop E2E specs must stay green, and they are the gate |
| Prices are minor units | Format once, in a helper; a hardcoded `/100` scattered through templates is how currency bugs start |
| A sold-out variant must be unselectable, not merely styled | Assert `disabled`, as the Gallery lightbox specs assert for unavailable days |
| Currency switcher may be cosmetic | Resolve §2's open question before building it |
| `MerchItemDetail` is reached from Music's "Buy physical" | Both routes must survive; check links resolve in `dist/` in both directions |

---

## 5. Verification

The gates that have caught every real bug on this branch:

- `pnpm build` in `web/` — runs the token lint, which now also fails on
  *undefined* tokens
- resolve every href in `dist/` and test the module gate both directions
- E2E against the running `web` container, capturing `pageerror`
- the **existing** shop specs must stay green — they cover the cart and checkout
- `bash scripts/test-all.sh` before the PR

---

## 6. Also outstanding: `ReleaseDetail`

Not Shop, but found by the same audit and easy to miss.

`components/detail/ReleaseDetail.astro` — the release detail page at
`/[lang]/{releases-slug}/{id}` — **was never ported**. The Music PR did the list
page and its discography links straight to it, so a visitor moves from a 2-Tone
page to a pre-theme one in a single click.

It is small, has no design file of its own (`Music.html` covers the list), and
should be restyled by extension like the four undesigned pages: `PageHero`, the
featured-release layout already written in `ReleasesSection`, and `TrackList.vue`
for the tracklist. Its lyrics can reuse `LyricsViewer.vue`.

Do this **before** Shop — it is the shorter job and closes a visible seam.
