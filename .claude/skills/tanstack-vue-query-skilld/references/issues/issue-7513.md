---
number: 7513
title: "Bug: Dependent Query doesn't work with solid-js SSR"
type: bug
state: open
created: 2024-06-04
url: "https://github.com/TanStack/query/issues/7513"
reactions: 1
comments: 8
labels: "[bug, package: solid-query]"
---

# Bug: Dependent Query doesn't work with solid-js SSR

### Describe the bug

In the Tanstack documentation there is a section about dependent queries: https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries

The example suggest that you should use `enable` to create dependent queries. The problem when using `enable` is that when it is disabled it doesn't suspend the current context and therefore doesn't fetch on the server.

### Your minimal, reproducible example

https://codesandbox.io/p/github/BierDav/temp-tanstack-query-ssr-bug/master?import=true

### Steps to reproduce

...