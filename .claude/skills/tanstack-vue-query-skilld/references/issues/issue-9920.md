---
number: 9920
title: Branded queryKey in queryOptions causes TS error (TS2769) in useQuery
type: other
state: open
created: 2025-11-27
url: "https://github.com/TanStack/query/issues/9920"
reactions: 3
comments: 1
labels: "[package: vue-query]"
---

# Branded queryKey in queryOptions causes TS error (TS2769) in useQuery

### Describe the bug

I’m encountering a TypeScript overload mismatch (**TS2769**) when calling `useQuery()` with the result of a `queryOptions(...)` function whose returned object contains a `queryKey` with a branded type. The error occurs specifically when `useQuery()` receives the output of `queryOptions(...)` containing a branded value in `queryKey`.

Passing the same options to `queryClient.fetchQuery(queryOptions(queryKey: brandedKey, queryFn))` — works fine.
Passing the branded key inline to useQuery (i.e. `useQuery({ queryKey: brandedKey, queryFn}))` — works fine.

### Your minimal, reproducible example

https://codesandbox.io/p/devbox/tanstack-query-ts-error-2769-forked-spc8jh?file=%2Fsrc%2FPost.vue

### Steps to reproduce

**1.** Define a branded type in your code:

...