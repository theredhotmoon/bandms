---
number: 9399
title: Hydration error using loading state of useQuery when prefetching
type: other
state: open
created: 2025-07-10
url: "https://github.com/TanStack/query/issues/9399"
reactions: 4
comments: 10
---

# Hydration error using loading state of useQuery when prefetching

### Describe the bug

If you prefetch data on the server and then use ``useQuery`` with ``isLoading`` on the client, it can lead to a hydration error.

### Your minimal, reproducible example

https://stackblitz.com/~/github.com/Icestonks/react-query-trpc-test

### Steps to reproduce

1. Prefetch something on the server
2. Hydrate it to the client
3. Use ``useQuery`` in the client, and have a loading fallback with ``isLoading``.

Then there should come a hydration error.

### Expected behavior

When first building and starting the project, we should see an hydration error. The error can also come at other times, but that's the most reliable way, to get the error to occur.

### How often does this bug happen?

Sometimes

### Screenshots or Videos

...