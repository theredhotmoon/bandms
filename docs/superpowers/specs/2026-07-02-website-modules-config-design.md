# Website Modules Configuration

**Date:** 2026-07-02
**Status:** Approved

## Overview

Extend the Website Modules admin page with two per-module settings:

1. **Custom name** — override the public-facing label per locale (EN / PL), falling back to the seeded `display_name` when absent.
2. **Items per page** — for list-type modules, control how many items Astro renders per paginated page.

Both settings are edited via an **expand-row** interaction: a pencil icon on the right of each module row opens an inline form; only one row can be open at a time.

---

## Data model

Two new nullable columns on `website_modules`:

| Column | Type | Notes |
|---|---|---|
| `custom_name` | text nullable | JSON via Spatie Translatable: `{"en":"...","pl":"..."}` |
| `per_page` | tinyint unsigned nullable | null = Astro default; constrained to allowed set |

`display_name` is never modified — it remains the seeded fallback.

---

## Backend

### Migration

```
database/migrations/2026_07_02_000001_add_config_to_website_modules_table.php
```

- Add `custom_name` (text nullable, after `display_name`)
- Add `per_page` (tinyint unsigned nullable, after `custom_name`)

### Model — `WebsiteModule`

- Add `HasTranslations` trait (Spatie)
- Add `custom_name` to `$translatable` and `$fillable`
- Add `per_page` to `$fillable`; cast to integer (nullable)

### Resource — `WebsiteModuleResource`

Admin response adds:

```json
{
  "custom_name": { "en": "Merch", "pl": "Sklep" },
  "per_page": 12
}
```

Both `custom_name` keys are always present (null if unset). `per_page` is integer or null.

### Controller — `WebsiteModuleController`

Extend `update(Request $request, string $slug)`:

- Accept any combination of `enabled` (boolean), `custom_name` (array), `per_page` (integer|null)
- Validation rules:
  - `custom_name.en` — nullable string, max 80
  - `custom_name.pl` — nullable string, max 80
  - `per_page` — nullable integer, in:[6,9,10,12,15,20,24]
- Use `setTranslations('custom_name', [...])` when `custom_name` is present
- Set `per_page` directly when present in payload

### Public endpoint — `SiteConfigController`

`GET /api/site-config` response per module gains:

```json
{
  "slug": "shop",
  "label": "Merch",
  "per_page": 12,
  "enabled": true,
  "sort_order": 7
}
```

`label` = `$module->getTranslation('custom_name', $locale) ?: $module->display_name`

Locale resolved from request (existing `SetLocale` middleware already handles `?lang=`).

---

## Frontend

### Types — `website-module.ts`

```ts
export interface WebsiteModule {
  slug: string
  display_name: string
  custom_name: { en: string | null; pl: string | null }
  enabled: boolean
  sort_order: number
  per_page: number | null
  updated_at: string
}
```

### API — `website-modules.ts`

New function `updateModuleSettings`:

```ts
updateModuleSettings(
  token: string,
  slug: string,
  payload: { custom_name?: { en: string | null; pl: string | null }; per_page?: number | null }
): Promise<void>
```

Calls `PUT /api/admin/modules/{slug}`.

### Composable — `useWebsiteModules.ts`

New mutation `updateSettings`:

- Key: `['modules']` invalidated on success
- Optimistic update not required (save is explicit)

### View — `WebsiteModulesView.vue`

**State additions:**

```ts
const editingSlug = ref<string | null>(null)
const draftNameEn  = ref<string>('')
const draftNamePl  = ref<string>('')
const draftPerPage = ref<number | null>(null)
```

**Row interaction:**

- Pencil icon (always visible, right side between badge and toggle)
- Click pencil: set `editingSlug`, populate drafts from current module values
- Opening a row while another is open silently discards the previous draft
- `Cancel` button: set `editingSlug = null`
- `Save` button: call `updateSettings` mutation, then `editingSlug = null`

**Expand-row layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│ ⠿ 1  Shop  /merch                        [Off]  □ Disabled  ✎   │
│ ─────────────────────────────────────────────────────────────────│
│  Custom name   [EN ________________]  [PL ________________]      │
│  Items per page  ▼ Default ─────────────────────────────────     │
│                                         [Cancel]  [Save]         │
└──────────────────────────────────────────────────────────────────┘
```

- `per_page` select shown only for slugs in `LIST_SLUGS = new Set(['news','concerts','photos','press','videos','shop'])`
- EN/PL inputs: placeholder = `display_name` (shows what public site currently shows)
- Empty string saved as `null` (reverts to `display_name`)
- Row visible name: `module.custom_name.en ?? module.display_name`

**Constants:**

```ts
const LIST_SLUGS      = new Set(['news','concerts','photos','press','videos','shop'])
const PER_PAGE_OPTIONS = [6, 9, 10, 12, 15, 20, 24] as const
```

---

## Validation rules summary

| Field | Rule |
|---|---|
| `custom_name.en` | nullable, string, max:80 |
| `custom_name.pl` | nullable, string, max:80 |
| `per_page` | nullable, integer, in:6,9,10,12,15,20,24 |

---

## Out of scope

- Translating admin UI strings (UI remains English-only)
- Custom name for non-module content (band name, site title)
- Per-page settings for non-list modules (EPK, tech-rider, newsletter)
