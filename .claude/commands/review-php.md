# PHP / Laravel Code Review

Review the given PHP/Laravel code (or the current diff's `*.php` files) against
the checklist below. Report findings grouped by severity (🔴 must-fix /
🟡 should-fix / 🟢 nit), each with `file:line` and a concrete fix.

## Checklist

**Correctness & types**
- `declare(strict_types=1)` where the project uses it; typed properties,
  params, and return types. No silent `mixed`.
- Null-safety: avoid `?->` masking real null bugs; validate before use.
- No `==` where `===` is meant; beware loose comparisons / type juggling.

**Laravel idioms**
- Use Eloquent relationships + eager loading; **no N+1** (look for queries in
  loops — suggest `with()`).
- Mass-assignment: `$fillable`/`$guarded` set correctly; never `Model::create($request->all())` unguarded.
- Validation in Form Requests or `$request->validate()`, not ad-hoc.
- Use route-model binding instead of manual `find()`+404.
- Resourceful controllers thin; business logic in actions/services, not controllers.
- Prefer `config()` over `env()` outside config files (env is null after cache).
- Database changes via migrations; no schema edits in code.

**Security**
- Authorization: policies/gates or middleware on every protected route; don't
  trust client-supplied ids — scope to the authenticated user/tenant.
- No raw SQL string interpolation — use bindings / query builder.
- Never return secrets, tokens, or password hashes in API responses/resources.
- Mass-assignment of sensitive fields (role, is_admin) blocked.
- File uploads validated (mime, size); stored outside webroot.

**Quality**
- PSR-12 formatting (this repo uses Laravel Pint — flag violations).
- Small, single-responsibility methods; meaningful names.
- No dead code, leftover `dd()`/`dump()`/`Log::debug` noise.
- Tests for new behavior (Pest/PHPUnit) where the project has them.

Review target: $ARGUMENTS
