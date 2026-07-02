# Website Modules — Disabled Row Styling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make disabled module rows visually distinct from enabled ones — currently `opacity-60` is too subtle; use reduced padding + dimmer text instead.

**Architecture:** Pure CSS/template change in `WebsiteModulesView.vue`. No API, no backend, no type changes. Compatible with both the current row structure and the restructured row from the `2026-07-02-website-modules-config` plan (apply on top of whichever version is live).

**Tech Stack:** Vue 3, Tailwind CSS v4.

## Global Constraints

- No new Tailwind classes outside what the project already uses.
- Change must not break drag-and-drop or the toggle checkbox.

---

### Task 1: Restyle Disabled Rows

**Files:**
- Modify: `app/src/views/admin/WebsiteModulesView.vue`

**Note:** If the `website-modules-config` plan has already been applied, the row structure has been restructured (outer wrapper + inner row div). Apply the changes to that structure. If not yet applied, apply to the original flat row. The diff below shows what changes regardless of which version is live.

**What changes:**

| | Before | After |
|---|---|---|
| Disabled row padding | `py-3` (same as enabled) | `py-1.5` |
| Disabled row opacity | `opacity-60` on whole row | removed |
| Disabled module name | `text-white` (via opacity) | `text-zinc-500` explicitly |

Enabled rows remain unchanged.

- [ ] **Step 1: Open `app/src/views/admin/WebsiteModulesView.vue` and locate the row class binding**

If the `website-modules-config` plan has been applied, the relevant binding looks like:

```vue
<div
  class="flex items-center gap-3 px-4 transition-colors"
  :class="mod.enabled ? 'py-3' : 'py-1.5'"
  ...
>
```

And the module name span:

```vue
<span
  class="font-semibold text-sm"
  :class="mod.enabled ? 'text-white' : 'text-zinc-500'"
>
```

Both are already correct if the config plan was applied — **skip to Step 3**.

If the **original flat row** is still in place, the row looks like:

```vue
<div
  class="flex items-center gap-3 rounded-xl border bg-zinc-900 px-4 py-3 transition-colors select-none"
  :class="{
    'border-zinc-700': mod.enabled,
    'border-zinc-800 opacity-60': !mod.enabled,
    'border-t-2 border-t-teal-500': dragOverIndex === i,
  }"
  ...
>
```

And the module name:

```vue
<span class="font-semibold text-white text-sm">{{ mod.display_name }}</span>
```

- [ ] **Step 2: Apply the styling changes to the original flat row**

Change the row class binding from:

```vue
:class="{
  'border-zinc-700': mod.enabled,
  'border-zinc-800 opacity-60': !mod.enabled,
  'border-t-2 border-t-teal-500': dragOverIndex === i,
}"
```

To:

```vue
:class="{
  'border-zinc-700 py-3': mod.enabled,
  'border-zinc-800 py-1.5': !mod.enabled,
  'border-t-2 border-t-teal-500': dragOverIndex === i,
}"
```

And remove `py-3` from the static class (it's now in the binding):

```vue
class="flex items-center gap-3 rounded-xl border bg-zinc-900 px-4 transition-colors select-none"
```

Change the module name span from:

```vue
<span class="font-semibold text-white text-sm">{{ mod.display_name }}</span>
```

To:

```vue
<span class="font-semibold text-sm" :class="mod.enabled ? 'text-white' : 'text-zinc-500'">{{ mod.display_name }}</span>
```

- [ ] **Step 3: Verify in the running dev server**

Open `http://localhost:5174/admin/website-modules`.

Check:
1. Enabled modules: full padding (`py-3`), white name text — same as before.
2. Disabled modules: compact rows (`py-1.5`), gray (`text-zinc-500`) name text — clearly different.
3. The "Off" badge and "Disabled" toggle label remain on disabled rows — no disappearing controls.
4. Drag-and-drop still works on disabled rows.
5. The toggle checkbox still enables/disables modules correctly.

- [ ] **Step 4: Commit**

```bash
git add app/src/views/admin/WebsiteModulesView.vue
git commit -m "style(modules): compact + dimmed disabled rows for clearer visual hierarchy"
```
