---
number: 4610
title: "TypeError: Cannot read properties of undefined (reading 'filter') Tanstack table (React)"
type: other
state: closed
created: 2022-12-18
url: "https://github.com/TanStack/table/issues/4610"
reactions: 14
comments: 15
labels: "[critical]"
---

# TypeError: Cannot read properties of undefined (reading 'filter') Tanstack table (React)

### Describe the bug

I have a working Tanstack table in dev mode. However, the minute I try to push it to prod, I get this error: 

```
framework-3b5a00d5d7e8d93b.js:9 TypeError: Cannot read properties of undefined (reading 'filter')
    at 338-40b21a5eb2cada72.js:42:10338
    at Object.getVisibleLeafColumns (338-40b21a5eb2cada72.js:39:249)
    at 338-40b21a5eb2cada72.js:42:5838
    at Object.getHeaderGroups (338-40b21a5eb2cada72.js:39:249)
    at u (index-ef857841339be48b.js:1:1605)
    at ak (framework-3b5a00d5d7e8d93b.js:9:60917)
    at i (framework-3b5a00d5d7e8d93b.js:9:119475)
    at oD (framework-3b5a00d5d7e8d93b.js:9:99114)
    at framework-3b5a00d5d7e8d93b.js:9:98981
    at oO (framework-3b5a00d5d7e8d93b.js:9:98988)
a9 @ framework-3b5a00d5d7e8d93b.js:9
main-f2e125da23ccdc4a.js:1 TypeError: Cannot read properties of undefined (reading 'filter')
    at 338-40b21a5eb2cada72.js:42:10338
    at Object.getVisibleLeafColumns (338-40b21a5eb2cada72.js:39:249)
    at 338-40b21a5eb2cada72.js:42:5838
    at Object.getHeaderGroups (338-40b21a5eb2cada72.js:39:249)
    at u (index-ef857841339be48b.js:1:1605)
    at ak (framework-3b5a00d5d7e8d93b.js:9:60917)
    at i (framework-3b5a00d5d7e8d93b.js:9:119475)
    at oD (framework-3b5a00d5d7e8d93b.js:9:99114)
    at framework-3b5a00d5d7e8d93b.js:9:98981
    at oO (framework-3b5a00d5d7e8d93b.js:9:98988)
$ @ main-f2e125da23ccdc4a.js:1
main-f2e125da23ccdc4a.js:1 A client-side exception has occurred, see here for more info: https://nextjs.org/docs/messages/client-side-exception-occurred
```

### Your minimal, reproducible example

https://stackblitz.com/edit/nextjs-pf2fbn?file=README.md

### Steps to reproduce

deploy that code anywhere, and it will fail after you add the files (works 100% in dev mode).

Github repo here -> https://github.com/jrhager84/moby-dick

Version that crashes (Cloudflare Pages) - https://moby-dick.pages.dev/

### Expected behavior

Table should render

...