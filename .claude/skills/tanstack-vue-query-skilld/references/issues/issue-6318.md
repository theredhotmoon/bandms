---
number: 6318
title: "[vue-query]: Fresh Vue3 project + Tanstack - Typescript errors, This is likely not a portable."
type: bug
state: closed
created: 2023-11-06
url: "https://github.com/TanStack/query/issues/6318"
reactions: 14
comments: 34
labels: "[bug, types, has workaround]"
---

# [vue-query]: Fresh Vue3 project + Tanstack - Typescript errors, This is likely not a portable.

### Describe the bug

With a fresh Vue3 installation with `@tanstack/vue-query` installed - VSCode produces typescript errors, as seen in the screenshot.

It's not clear to me if this is an issue with `tanstack-query`, `vue3` - or `typescript`. There seems to be various issues around that suggest it might be any of them.

Its worth noting that the project still runs and produces expected results.

`tanstack/vue-query` does not have this issue on V4. It only occurs after moving to V5.

### Your minimal, reproducible example

https://github.com/cadriel/tanstack-query-issue

### Steps to reproduce

1. Clone the example project. https://github.com/cadriel/tanstack-query-issue
2. Open the project in VSCode - ensure you've installed and configured the Vue dev tools (Volar, etc..)
3. See the error as per the screenshot above.

### Expected behavior

I'd expect to not see any errors in VSCode, and for the types to be correctly inferred.

### How often does this bug happen?

Every time

### Screenshots or Videos

<img width="1213" alt="Screenshot 2023-11-06 at 10 38 54 AM" src="https://github.com/TanStack/query/assets/205520/154269fb-5920-40a1-82e2-0a7b207cb1d1">

### Platform

macOS, VSCode.

### Tanstack Query adapter

vue-query

### TanStack Query version

V5+

### TypeScript version

V5.2.2 (as per `npm create vue@latest`)

### Additional context

_No response_

---

## Top Comments

**@cadriel** (+4):

Yes, you can add the type manually for the example. However, as soon as you add any complexity (mutations, etc..) - then it becomes very cumbersome to figure out what types to import.

I couldn't figure out what types to import at all for some circumstances.

The `moduleResolution` suggestion may cause other issues.

Ideally there should be no other requirements. Thanks for looking into this further.


**@Andarist** (+4):

I've done a quick analysis locally and i strongly believe that it's caused by `tsup` mangling~ (and renaming) exports in the declaration files. Instead of exporting `UseQueryReturnType` directly from `useQuery-d58edace.d.ts` and exporting it under the same name in `index.d.ts`, it exports it like this `UseQueryReturnType as b` and reexports it from `index.d.ts` like this: `export { b as UseQueryReturnType } from './useQuery-d58edace.js';`.

I think this might introduce an indirection that confuses TypeScript and it fails to recognize that this type is actually exported from `@tanstack/vue-qu...

**@piotrpalek** (+8):

I would consider this a showstopper, this seems like an extremely big issue in actually using vue-query