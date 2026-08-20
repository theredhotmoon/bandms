# TypeScript Code Review

Review the given TypeScript (or the current diff's `*.ts`/`*.tsx` files) against
the checklist below. Report findings by severity (🔴/🟡/🟢) with `file:line`
and a concrete fix.

## Checklist

**Type safety**
- No `any` (explicit or implicit). Prefer `unknown` + narrowing, generics, or a
  precise type. Flag `as` casts that hide real mismatches.
- `strict` mode assumptions hold: handle `null`/`undefined`; no non-null `!`
  used to silence the compiler without justification.
- Discriminated unions over boolean flags / optional grab-bags for state.
- Return types on exported functions; don't rely on inference across module
  boundaries.
- `readonly` / `as const` for immutable data; avoid accidental widening.

**API & runtime boundaries**
- Validate external data (HTTP, localStorage, env) at the edge — this project
  uses **Zod**; parse, don't assume. Don't trust `JSON.parse` shapes.
- Errors typed/handled; no swallowed promises (every `async` awaited or `.catch`ed).

**Design**
- Prefer pure functions; isolate side effects.
- No leaking implementation types through public module APIs (`index.ts`).
- Enums: prefer union literals or `as const` objects unless a real enum is needed.
- DRY types via utility types (`Pick`, `Omit`, `Partial`) instead of duplication.

**Quality**
- Names say intent; no `data2`, `tmp`, abbreviations.
- ESLint/Prettier clean (this repo enforces both).
- No `console.log` left in; no commented-out code.

Review target: $ARGUMENTS
