---
number: 8825
title: "Next.js: exception encountered in prefetchInfiniteQuery causes useSuspenseInfiniteQuery to fail"
type: bug
state: open
created: 2025-03-17
url: "https://github.com/TanStack/query/issues/8825"
reactions: 0
comments: 7
labels: "[bug]"
---

# Next.js: exception encountered in prefetchInfiniteQuery causes useSuspenseInfiniteQuery to fail

### Describe the bug

I believe there is some weird behaviour when a `prefetchInfiniteQuery` fails in a server component and `useSuspenseInfiniteQuery` retries to fetch the data on the client. The exception thrown is: `Uncaught TypeError: Cannot read properties of undefined (reading 'length')`. I have spent some time debugging into this, it feels like after the failure on the server, the client retries to fetch the data and upon a successful response, it doesn't modify the response to be in the expected `{pages: [], pageParams:[]}` format, but treats it like a normal query response.

I have also noticed that query options passed are ignored (such as retry: 0).

### Your minimal, reproducible example

https://codesandbox.io/p/devbox/9lyl7g

### Steps to reproduce

...