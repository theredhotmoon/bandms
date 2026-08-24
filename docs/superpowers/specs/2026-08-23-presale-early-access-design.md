# Pre-sale Early Access — Design

*2026-08-23*

---

## TL;DR

Pre-sale ships as a shell: there are codes, a pivot linking them to tiers, admin CRUD and a `validate` endpoint — but nothing anywhere marks a ticket as gated, hides it, or refuses to sell it. Two Vue components were built against gating that was never implemented and have sat unreferenced ever since.

This makes a pre-sale code mean one thing: **early access to tickets before they go on public sale**. The code shifts *when* you may buy, not *what* you pay.

The server stays the only authority. The code travels with the request — as a query parameter on the public listing, and in the checkout payload — and is re-validated independently in both places. The client's "unlocked" state is presentation only.

---

## Part 1 — What exists today

| Piece | State |
|---|---|
| `presale_codes` table | real — `code`, nullable `concert_id`, `max_uses`, `used_count`, `valid_from`, `valid_until`, `description` |
| `presale_code_tiers` pivot | real — links a code to specific price tiers |
| `PresaleCodeController` — index/store/destroy/validate | real, tested |
| `PresaleCodeManager.vue` (admin) | built, **zero references** |
| `PresaleUnlockWidget.vue` (public) | built, **zero references** |
| A way to mark a tier pre-sale-only | **does not exist** |
| Public listing hiding gated tiers | **does not exist** — `ConcertTicketController` has no presale references |
| Checkout enforcing a code | **does not exist** — `CheckoutController` has no presale references |
| `used_count` ever incremented | **never** |

So today a code can be created, listed, deleted and validated, and none of that affects what anyone can buy.

### The two granularities do not match

`presale_code_tiers` gates **tiers**. The public UI renders **types**, showing only whichever tier `ConcertTicketType::activeTier()` resolves to. Any design has to reconcile those.

### The public purchase flow is not Vue

`ConcertDetail.astro` renders `#tickets-section` and fills `#tickets-container` from a vanilla-TS `<script>` that fetches `/api/concerts/{id}/tickets` and builds HTML strings. It is not an island and does not import from `app/`. `PresaleUnlockWidget.vue` therefore cannot be mounted here as-is.

---

## Part 2 — The model

**A tier is gated when its sale window has not opened yet.** No new "is_presale" flag is introduced; the existing `available_from` columns already express "not yet on sale", and the public UI already renders that state as *"On sale from 5 Sep 2026, 09:00"*.

**A valid code grants early access to the tiers it covers**, letting the holder buy during the pre-sale window as though those tiers were already open.

Two rules fall out of the existing schema:

- **A code with no tiers linked covers every tier within its scope.** That is the whole-show pre-sale, and it is the common case. Linking tiers narrows it.
- **A code with a null `concert_id` is global** and may be used on any concert. That is already what `validate` does, and it is preserved.

The two combine, so scope is worth stating as a table rather than leaving it to be inferred:

| `concert_id` | tiers linked | Grants early access to |
|---|---|---|
| set | none | every tier of that concert |
| set | some | only those tiers, and only on that concert |
| null | none | **every tier of every concert** — a universal early-access code |
| null | some | only those tiers, wherever they live |

The third row is powerful and easy to create by accident, since both fields are optional. The admin UI should say plainly what a code will cover before it is generated.

A code is usable when all of the following hold: `valid_from` has passed or is null, `valid_until` has not passed or is null, and `used_count < max_uses` (or `max_uses` is null).

### What a code does not do

It does not change price, reveal hidden tiers, or bypass capacity, per-order limits or tier stock. Every existing guard still applies. The code relaxes exactly one check: the sale window.

---

## Part 3 — Server design

### 3.1 `PresaleCode::grantsAccessTo(ConcertTicketPriceTier $tier): bool`

One method, on the model, answering the only question the rest of the system asks. It checks the validity window, the usage limit, that the code's `concert_id` is null or matches the tier's concert, and that the pivot is either empty or contains the tier.

Everything else in this design calls that method. There is deliberately no second place where "is this code good for this tier" is decided.

### 3.2 Threading unlocked tiers through availability

`ConcertTicketType::activeTier()` and `isOnSale()` gain an optional `array $unlockedTierIds = []`:

- `activeTier()` — a tier passes the date gate if its window is open **or** its id is in `$unlockedTierIds`. Stock and ordering rules are untouched.
- `isOnSale()` — the type-level `available_from` check is skipped when the resolved active tier is unlocked.

Defaulting to an empty array means every existing caller keeps today's behaviour, which is what the current tests assert.

### 3.3 `GET /api/concerts/{concert}/tickets?presale_code=X`

The parameter is optional. The controller resolves the code to a set of unlocked tier ids and passes them into `ConcertTicketTypeResource`.

The response gains one block so the UI can explain itself:

```json
"presale": { "applied": true, "code": "STORKS24", "message": null }
```

On a bad code, `applied` is `false` and `message` carries the reason (`Invalid code.`, `Code has expired.`, `Code has reached its usage limit.`) — the same strings `validate` already returns. **An invalid code never fails the request**; the listing renders exactly as it would without one. That keeps a mistyped code from breaking the page.

Without the parameter, the response is byte-identical to today's.

### 3.4 Checkout

`POST /api/checkout` accepts an optional `presale_code`. When the existing sale-window guard would abort, it first checks whether the code grants access to that tier; if so, the purchase proceeds. If the code is absent, invalid or does not cover the tier, the existing 422 stands unchanged.

A code that has reached `max_uses` is rejected at checkout with 422, not silently ignored.

This re-validation is independent of the listing. **A crafted request carrying a fabricated code buys nothing.**

### 3.5 Recording usage

`orders` gains a nullable `presale_code_id`, mirroring the existing `promo_code_id`. The Stripe webhook increments `used_count` on a paid order, next to the promo-code increment already there.

Usage counts purchases, not attempts. Incrementing on `validate` would let anyone exhaust a code's allowance without buying anything.

The webhook's existing `lockForUpdate()` + `status !== Pending` guard already makes this replay-safe: a redelivered event short-circuits before any increment.

**Known limit:** `max_uses` is checked when checkout is created, not reserved. More buyers can be mid-checkout than a code allows, so a code may end slightly over its limit. Reserving would mean holding a row against an abandoned Stripe session. Acceptable for band-scale pre-sales, and stated here so it is a decision rather than a surprise.

---

## Part 4 — Client design

### 4.1 Admin

`PresaleCodeManager.vue` mounts inside the existing Tickets modal in `ConcertsAdminView`, below `ConcertTicketsManager`. It needs `concertId` (already there) and `tiers`, flattened from the ticket-types query the modal already runs.

One change to the component: a plain-language line in the generate form stating what the code will cover before it is created — *"Covers all tiers for this concert"* when none are selected, or *"Covers: Early Bird, VIP"* when they are. Both fields being optional makes an over-broad code easy to create by accident, and a sentence is cheaper than discovering it after the codes are sent out.

### 4.2 Public

The vanilla-TS script in `ConcertDetail.astro` gains, above the ticket list and only when at least one type is not on sale:

> **Have a pre-sale code?** `[____________]` `[Unlock]`

Submitting re-fetches the listing with `?presale_code=` and re-renders from the response. The server decides what became buyable; the script only renders what it is given. Applied codes show a confirmation line; rejected codes show the server's message and leave the list untouched.

The code is held in a module-level variable and appended to the checkout POST. It is deliberately **not** persisted to `localStorage` — a shared machine should not carry someone's pre-sale access into the next visitor's session.

### 4.3 Deletions

`PresaleUnlockWidget.vue` is deleted. It targets a Vue runtime this page does not have, and reimplementing it inline is smaller than bridging two runtimes over one section.

`POST /api/presale-codes/validate` is **kept**. It is built, tested, and gives a cheap validity check without re-fetching a listing. It is no longer on the critical path — a judgement call, noted here because the alternative (deleting it and its tests) is defensible too.

---

## Part 5 — Testing

**Backend (Pest)**

- `grantsAccessTo` — open window, not yet valid, expired, exhausted, wrong concert, global code, empty pivot covers all tiers, linked pivot narrows.
- Listing without a code — a not-yet-open tier reports `is_on_sale: false`.
- Listing with a valid code — the same tier reports `is_on_sale: true` and `presale.applied` is true.
- Listing with an invalid, expired or exhausted code — unchanged availability, `applied: false`, and a message.
- Checkout without a code for a not-yet-open tier — 422, message unchanged.
- Checkout with a valid code — succeeds.
- Checkout with a code that does not cover the tier — 422.
- Checkout with an exhausted code — 422.
- Webhook — `used_count` increments once on payment; a redelivered event does not double-count.
- Every existing ticket test still passes untouched, which is what proves the default-empty-array threading is inert.

**E2E (Playwright)**

- Admin: generate a batch of codes in the Tickets modal, see them listed, delete one.

The public flow is not covered: every existing spec targets the admin SPA on `:5173`, and the Astro site would need a second Playwright project. Noted as a gap, not addressed here.

---

## Part 6 — What this deliberately does not do

- **No new gating flag.** `available_from` already expresses it.
- **No hidden tiers.** Rejected during design as a second gating concept for one feature.
- **No per-buyer code binding.** Codes are shareable by nature; `max_uses` is the control.
- **No presale UI on the public site beyond one input.** The band's pre-sale is an email with a code in it, not a portal.

---

## Open questions

None blocking. Two judgement calls are recorded above rather than hidden: keeping `/validate`, and checking `max_uses` at checkout rather than reserving it.
