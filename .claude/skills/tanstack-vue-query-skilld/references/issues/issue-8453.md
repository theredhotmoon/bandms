---
number: 8453
title: TypeScript errors when using exported queryOptions factory in @tanstack/react-query 5.62.8
type: other
state: open
created: 2024-12-18
url: "https://github.com/TanStack/query/issues/8453"
reactions: 22
comments: 18
labels: "[types, package: react-query]"
---

# TypeScript errors when using exported queryOptions factory in @tanstack/react-query 5.62.8

### Describe the bug

When using the factory `queryOptions` and exporting the result, TypeScript errors appear:

```
Exported variable 'shopsQuery' has or is using name 'dataTagErrorSymbol' from external module "/node_modules/@tanstack/query-core/build/legacy/hydration-DiTAi-4H" but cannot be named. (ts4023)

Exported variable 'shopsQuery' has or is using name 'dataTagSymbol' from external module "/node_modules/@tanstack/query-core/build/legacy/hydration-DiTAi-4H" but cannot be named. (ts4023)
````

These errors occur in every instance where I export the result of `queryOptions`. Removing the export resolves the issue, but that isn't an acceptable workaround.

### Your minimal, reproducible example

https://www.typescriptlang.org/play/?#code/JYWwDg9gTgLgBAbzgRwK4FMoE8DyYbAQB2AznAL5wBmUEIcARAAIwCGpbAxgNYD0U6VpxgBaNJiwMAsAChZnYiXgKoA4QEUM2PAUVwAvCi258hUgAoEsuEYkBpdFgBccANoByFWpjuAugBpZcgBKWTCZdAAPSFg4BQ44YCIAN1YAG2AAE00JHTMyQ3FtU0VLa1tsB2c3dyTUjMy-QJkQoA

### Steps to reproduce

1. Install the latest version of @tanstack/react-query (v5.62.8).
2. Create and export a variable using `queryOptions` factory, e.g., `export const shopsQuery = queryOptions(...);`.
3. Observe TypeScript errors as described.

### Expected behavior

The `queryOptions` factory should allow exporting without triggering TypeScript errors.

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

- OS [Windows, Linux]

### Tanstack Query adapter

react-query

### TanStack Query version

v5.62.8

### TypeScript version

v5.7.2

### Additional context

_No response_

---

## Top Comments

**@codelonesomest** (+9):

I got the same problem as well in `v5.62.8` but no problem in `v5.62.7`.

**@juliusmarminge** [maintainer]:

> @juliusmarminge we've solved this for tRPC before, right?

Did you create some new types that aren't exported from a public entrypoint? That's usually a primary cause.

But RQ is, and never will be with the current behaviors in TypeScript, not fully portable since it relies on `@tanstack/query-core` internals that users doesn't automatically install. This is the case for all libs that relies on a "core" package. A fix for those cases is that the user installs both libs explicitly which makes it easier for TypeScript to discover the scanned paths when emitted the declaration files.

**@TkDodo** [maintainer]:

> If you have an application then you may not need tsconfig to have compilerOptions.declaration: true - setting it false should squash the error

definitely need `declaration: true` for monorepos

> In this case no these symbols aren't exported by either query-core or rq/angular directly, I will play with an MR which changes this as we already have a reproduction in tRPC that I can test against

we can export the symbols from the core, no problem.

> Can they not be defined and exported in the framework package?

...