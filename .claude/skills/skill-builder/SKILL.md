---
name: skill-builder
description: Build a high-quality Claude Code skill (SKILL.md). Use when asked to create, design, or write a new skill, slash-command skill, or project skill for Claude Code.
origin: local
---

# Skill Builder

How to write Claude Code skills that actually work — skills that get loaded at the right time, stay useful over many conversations, and give Claude the right knowledge without bloating context.

---

## When to Use

- Asked to create or design a new skill for this repo
- Reviewing or improving an existing SKILL.md
- Deciding whether a task deserves a skill vs. a CLAUDE.md section vs. a memory

---

## What a Skill Is

A skill is a Markdown file loaded into Claude's context **on demand** when a slash command (`/skill-name`) is invoked. It is not always present — only the description in the system prompt is always visible. This distinction drives every design decision below.

```
.claude/skills/<skill-name>/
├── SKILL.md              ← required; loaded when skill is invoked
└── references/           ← optional; link from SKILL.md, loaded on demand
    ├── _INDEX.md
    └── topic.md
```

---

## The Four Parts of Every Good Skill

### 1. Frontmatter (YAML)

```yaml
---
name: skill-name           # kebab-case; matches the directory name
description: >             # THE MOST IMPORTANT FIELD — see below
  One or two sentences used by the system to decide when to suggest
  this skill. Must name the exact trigger — library, task type, file
  pattern, or command the user will type.
origin: local              # "local" for hand-written; "ECC" for generated
---
```

**The `description` field is the only thing Claude sees before the skill is loaded.**
Write it so that any of these will match: the library name, the import path, the task verb ("audit", "build", "create"), the slash command the user will type. If the description is vague, the skill is never invoked.

Good:
```
description: >
  Build a high-quality Claude Code skill (SKILL.md). Use when asked to create,
  design, or write a new skill or slash-command skill for Claude Code.
```

Bad (too vague — what triggers "guidance"?):
```
description: Guidance for improving code quality.
```

### 2. `## When to Use` Section

List the precise conditions that should trigger this skill. Be concrete — trigger on file paths, import names, task types, or user phrasing.

```markdown
## When to Use

- User is writing code that imports `@tanstack/vue-query`
- Debugging a `useQuery` / `useMutation` call
- Any file under `frontend/src/composables/` that uses the query client
```

This section also serves as a self-check: if you cannot write 3–5 crisp bullet points, the skill's domain is probably too broad or too vague.

### 3. Body Content

Organize by **topic**, not by execution order. Claude will jump to the relevant section, not read top to bottom.

Good structure:
```markdown
## Core Concepts
## Common Patterns (with code examples)
## Constraints (MUST / MUST NOT)
## Reference Guide (table linking to references/)
```

Rules:
- Every abstract claim needs a concrete code example.
- Keep each section focused — one idea per section.
- Use MUST / MUST NOT tables for hard constraints.
- Link to `references/` files for anything longer than ~50 lines.

### 4. Reference Files (optional, for large skills)

When the skill covers a large API surface, split supplementary material into `references/`:

```
references/
├── _INDEX.md      ← table of contents — always include this
├── patterns.md
└── api.md
```

Link from SKILL.md with relative paths:
```markdown
## Reference Guide

| Topic | File | Load When |
|-------|------|-----------|
| Patterns | `references/patterns.md` | Building a new composable |
| API surface | `references/api.md` | Looking up method signatures |
```

---

## Constraints

### MUST DO

- Write the `description` as if it is the only thing Claude will see — because it often is.
- Put a `## When to Use` section near the top.
- Include at least one complete, runnable code example per major concept.
- Keep SKILL.md under ~300 lines; move the rest to `references/`.
- Match the directory name to the `name:` field exactly.

### MUST NOT DO

- Do not describe what Claude already knows (language basics, HTTP fundamentals). Only add what Claude would get wrong without the skill.
- Do not make the description a single generic verb like "Helps with PHP". Name the library, framework, or task.
- Do not write a skill for something that belongs in CLAUDE.md (project-wide conventions, env setup, architecture decisions).
- Do not combine two unrelated domains in one skill — split them.
- Do not copy-paste docs wholesale. Curate: keep only the parts that are non-obvious or error-prone.

---

## Skill vs. CLAUDE.md vs. Memory

| Use | Format |
|-----|--------|
| Domain knowledge loaded on demand (library API, audit checklist, task pattern) | **Skill** |
| Always-on project conventions, env setup, architecture decisions | **CLAUDE.md** |
| User preferences, workflow feedback, project state | **Memory** |

A skill is the right choice when: the knowledge is domain-specific, it is only needed sometimes, and loading it every time would waste context.

---

## Checklist Before Saving

- [ ] `description` names the exact trigger (library name, task verb, import path, slash command).
- [ ] `## When to Use` has 3+ specific bullet points.
- [ ] At least one complete code example exists.
- [ ] SKILL.md is under 300 lines (or material has been moved to `references/`).
- [ ] The skill directory name matches the `name:` field.
- [ ] The skill does not duplicate content already in CLAUDE.md.
- [ ] The `## When to Use` section would make a colleague say "yes, that's exactly when I'd reach for this."

---

## Anti-Patterns (from real skill failures)

**The Omnibus Skill**: a single skill covering "all PHP best practices". Too broad → description is vague → never triggered. Fix: split by domain (`laravel-tdd`, `laravel-security`, `php-pro`).

**The Doc Dump**: a skill that is just the library README copy-pasted. Bloats context with what Claude already knows. Fix: keep only the non-obvious parts — version-specific changes, common mistakes, project-specific patterns.

**The Invisible Trigger**: description says "Laravel helper skill". Nothing in a user message will ever match that. Fix: list every concrete phrase that should trigger it: "Eloquent", "artisan", "Laravel 11", "php artisan make".

**The CLAUDE.md Refugee**: a skill for "how to run the dev server". That is not domain knowledge — that is project setup and belongs in CLAUDE.md. Skills load on demand; setup instructions should always be present.

**The Thin Skill**: one paragraph of obvious advice with no code. If there is not enough to say, it is not a skill — it is a comment in CLAUDE.md.

---

## Example: Minimal Well-Formed Skill

```markdown
---
name: stripe-php
description: >
  Use when working with the Stripe PHP SDK, adding payments, processing webhooks,
  or handling Stripe API errors in Laravel. Triggers on imports of `\Stripe\Stripe`
  or `stripe/stripe-php`.
origin: local
---

# Stripe PHP

## When to Use
- Writing Stripe checkout, payment intent, or webhook handler code
- Importing `\Stripe\Stripe` or `Stripe\Stripe` in any file
- Reviewing or debugging Stripe API error handling

## Webhook Signature Verification

Always verify webhooks — skip this and any attacker can fake events.

\`\`\`php
$payload = $request->getContent();
$sigHeader = $request->header('Stripe-Signature');

$event = \Stripe\Webhook::constructEvent(
    $payload,
    $sigHeader,
    config('services.stripe.webhook_secret')
);
\`\`\`

## Constraints

MUST: Set `STRIPE_WEBHOOK_SECRET` in `.env` and never skip signature verification.
MUST NOT: Log the full event payload — it may contain card data.
```

---

## Registering the Skill

Skills in `.claude/skills/` are automatically available to everyone who clones the repo — no install step. The directory is committed to git.

To install a skill from the registry (not local):
```bash
npx skills add <owner/repo@skill-name> -a claude-code -y
```

To invoke a skill manually:
```
/skill-name
```
