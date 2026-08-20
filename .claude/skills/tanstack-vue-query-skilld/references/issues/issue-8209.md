---
number: 8209
title: "[solid-query] Uncaught (in promise) Error: experimental_prefetchInRender feature flag is not enabled"
type: other
state: closed
created: 2024-10-23
url: "https://github.com/TanStack/query/issues/8209"
reactions: 17
comments: 26
labels: "[package: solid-query]"
---

# [solid-query] Uncaught (in promise) Error: experimental_prefetchInRender feature flag is not enabled

### Describe the bug

When using the latest version of tanstack-query you get at least in solidjs for each query this error message in the console:
```
Uncaught (in promise) Error: experimental_prefetchInRender feature flag is not enabled
```

### Your minimal, reproducible example

https://codesandbox.io/p/github/BierDav/temp-tanstack-query-ssr-bug/experimental-flag-warning

### Steps to reproduce

1. Just start it using `bun i && bun dev`

### Expected behavior

No error message in the console, because the `promise` wasn't even accessed

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

- OS: Windows, Linux


### Tanstack Query adapter

solid-query

### TanStack Query version

v5.59.13

### TypeScript version

_No response_

### Additional context

I have looked into the code. It is not really that something went wrong, and more about that the promise which causes this issue is evaluated even though the feature is not set.

Probably the easiest solution is to replace the promise when the flag is not enable with a `getter` function which then only throws the error, when the promise is really accessed.

---

## Top Comments

**@vlad99902** (+6):

@TkDodo have the same issue in React (


**@TkDodo** [maintainer] (+1):

codesandobx still doesn’t work for me, but stackblitz does: https://stackblitz.com/github/BierDav/temp-tanstack-query-ssr-bug/tree/experimental-flag-warning

@KATT this promise rejection shows up in the solid-js adapter:

https://github.com/TanStack/query/blob/5d69ad773a7a2df632df48eefce6fd9772d26db7/packages/query-core/src/queryObserver.ts#L89-L93

Not sure why it works for react though  

Is there a better place where we can reject the promise - or should we do it at all?

**@PeterDraex** (+4):

StackBlitz link for the same repo:
https://stackblitz.com/~/github.com/BierDav/temp-tanstack-query-ssr-bug
After waiting for the dev server to start, I had to click on "http://localhost:3000/" in the terminal. Then I see JSON in the preview and the error in browser console.

I'm also experiencing the experimental_prefetchInRender feature flag error in my SolidJS project.