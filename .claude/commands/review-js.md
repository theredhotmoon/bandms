# JavaScript Code Review

Review the given JavaScript (or the current diff's `*.js`/`*.mjs`/`*.cjs`
files — e.g. configs, build scripts) against the checklist below. Report by
severity (🔴/🟡/🟢) with `file:line` and a concrete fix.

## Checklist

**Correctness**
- `===`/`!==` over `==`; beware coercion, `NaN`, `0`/`''`/`null` falsy traps.
- No undeclared globals; `const`/`let`, never `var`. Block-scope hygiene.
- Async: every promise awaited or `.catch`ed; no floating promises; no `await`
  inside loops where `Promise.all` is correct.
- Array/object mutation vs. copy — intentional, not accidental shared state.

**Safety**
- Never `eval`/`new Function` on dynamic input.
- Validate/sanitize external input (CLI args, env, file contents, network).
- No secrets hardcoded; read from env. Don't log secrets.
- Guard against prototype pollution when merging untrusted objects.

**Quality**
- Small focused functions; early returns over deep nesting.
- Meaningful names; no magic numbers (name constants).
- Prefer modern APIs (optional chaining, nullish `??`, spread) for clarity.
- No leftover `console.log`/debug; no dead/commented code.
- ESLint/Prettier clean.

Review target: $ARGUMENTS
