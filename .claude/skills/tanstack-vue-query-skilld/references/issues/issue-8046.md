---
number: 8046
title: Infinite query page param resets back to the first page during refetch if a page request is retried
type: other
state: closed
created: 2024-09-12
url: "https://github.com/TanStack/query/issues/8046"
reactions: 23
comments: 0
---

# Infinite query page param resets back to the first page during refetch if a page request is retried

### Describe the bug

I am using `useInfiniteQuery` to additively load more data into a table from a `nextToken` based list API (e.g. example AWS SDK list API). Requesting next pages and refetching works great for the most part, but I'm having some trouble figuring out a way to preserve the next page param for a **retried** request triggered by a manual or automated `refetch`.

When fetching next pages with `fetchNextPage` and the `queryFn` rejects with an error response, the request is retried as expected using the same page params. However, I noticed retried requests from a manual or automated `refetch` will start over back to the first page after the first error response is encountered. I understand the need to fetch sequentially from the first page for the refetch, however, I would expect the failed request to retry using the same page params and continue onto the next page request once a retry succeeds.

The backend service I'm working with has a reasonable rate limit set (50 TPM in a 1 minute sliding window), but I'm trying to ensure a manual or automatic `refetch` will be able to recover from worst-case rate limiting scenarios where the user can continuously rate-limit themselves by refetching a table view loaded with 50+ pages.

Original discussion: https://github.com/TanStack/query/discussions/8044

### Your minimal, reproducible example

https://codesandbox.io/p/sandbox/mqvdz4

### Steps to reproduce

...