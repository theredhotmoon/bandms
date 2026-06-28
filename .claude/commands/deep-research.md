# Deep Research

Conduct thorough, multi-source research on a topic and produce a decision-ready,
**sourced** report. Use this for any "should we / how do we / what are the
options / is X possible" question where a shallow answer isn't good enough —
e.g. evaluating a library, comparing approaches, a security hardening review,
pricing/licensing questions, or integration feasibility.

## Method (follow in order)

1. **Frame** — restate the question, list the concrete sub-questions that must
   be answered, and the decision the research feeds. Note any constraints from
   this project (stack, budget=free where possible, self-hostable, Polish+English
   audience — see `CLAUDE.md` and `README.md`).
2. **Gather — breadth first** — use `WebSearch` for current facts (pricing,
   versions, free-tier limits, MCP/tooling availability) and `WebFetch` to read
   primary sources (official docs, pricing pages, GitHub repos, changelogs).
   Prefer primary sources over blogs. For code/repo questions, also inspect the
   local codebase (Grep/Glob/Read) to ground the answer in what actually exists.
3. **Verify — depth** — cross-check every load-bearing claim against a second
   source. Call out anything you could **not** verify. Note dates — pricing and
   free tiers change; say "as of <date>".
4. **Synthesize** — don't dump search results. Produce the report below.

## Report format

- **Question & decision** — what's being decided.
- **TL;DR / recommendation** — the answer in 2–4 sentences, with confidence
  (high/medium/low) and why.
- **Findings** — the sub-questions answered, each with a one-line source ref
  (URL or `file:line`). Mark unverified items explicitly.
- **Options compared** — table of viable approaches with pros/cons, cost,
  effort, and fit with this project's stack.
- **Risks & unknowns** — what could change the answer; what still needs a
  human decision or an account/API key.
- **Next steps** — concrete, ordered actions. Separate "can do now" from
  "needs input from you" (credentials, paid plan, etc.).
- **Sources** — bulleted list of the key URLs/files consulted.

## Rules

- **Cite everything that matters.** A claim about price, a limit, or a feature
  without a source is a liability — link it or label it unverified.
- **Free / self-hostable first.** This is a charity project; prefer free tiers
  and open-source, and always say what the free tier actually includes.
- **Be honest about confidence.** "I couldn't confirm X" is more useful than a
  confident guess.
- Stay decision-focused — research serves a choice, end with the choice.

Research topic: $ARGUMENTS
