---
number: 7286
title: eslint-plugin-query is incompatible with Eslint 9.x
type: other
state: closed
created: 2024-04-16
url: "https://github.com/TanStack/query/issues/7286"
reactions: 32
comments: 3
---

# eslint-plugin-query is incompatible with Eslint 9.x

### Describe the bug

eslint-plugin-query has a peer dependency for eslint 8.
When I try to upgrade my project to use eslint 9, npm install fails due to peer dependency mismatch.

Thanks!

### Your minimal, reproducible example

Any NodeJS project

### Steps to reproduce

1. `npm i -D @tanstack/eslint-plugin-query@5.28.11`
2. `npm i -D eslint@9.0.0`
Erroneous output:
```
npm ERR! While resolving: eslint-import-resolver-typescript@3.6.1
npm ERR! Found: eslint@9.0.0
npm ERR! node_modules/eslint
npm ERR!   peer eslint@"^7.0.0 || ^8.0.0" from @typescript-eslint/utils@6.21.0
npm ERR!   node_modules/@tanstack/eslint-plugin-query/node_modules/@typescript-eslint/utils
npm ERR!     @typescript-eslint/utils@"^6.20.0" from @tanstack/eslint-plugin-query@5.28.11
npm ERR!     node_modules/@tanstack/eslint-plugin-query
npm ERR!       dev @tanstack/eslint-plugin-query@"^5.28.11" from the root project
npm ERR! 
npm ERR! Could not resolve dependency:
npm ERR! peer eslint-plugin-import@"*" from eslint-import-resolver-typescript@3.6.1
npm ERR! node_modules/eslint-import-resolver-typescript
npm ERR!   dev eslint-import-resolver-typescript@"^3.6.1" from the root project
npm ERR! 
npm ERR! Conflicting peer dependency: eslint@8.57.0
npm ERR! node_modules/eslint
npm ERR!   peer eslint@"^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8" from eslint-plugin-import@2.29.1
npm ERR!   node_modules/eslint-plugin-import
npm ERR!     peer eslint-plugin-import@"*" from eslint-import-resolver-typescript@3.6.1
npm ERR!     node_modules/eslint-import-resolver-typescript
npm ERR!       dev eslint-import-resolver-typescript@"^3.6.1" from the root project
```

### Expected behavior

Installation should be smooth :)

### How often does this bug happen?

None

### Screenshots or Videos

_No response_

### Platform

all

### Tanstack Query adapter

None

### TanStack Query version

5.28.11

### TypeScript version

_No response_

### Additional context

_No response_

---

## Top Comments

**@ffaubert**:

Is there a technical reason why this support has not been added so long after the eslint 9 release?

**@yotamselementor**:

Adding relevant links here:
https://github.com/TanStack/query/pull/7253
https://github.com/typescript-eslint/typescript-eslint/issues/8211


**@DaiFudo**:

It gives me a headache. I ran into a problem with these configs a year ago. Nothing has changed...