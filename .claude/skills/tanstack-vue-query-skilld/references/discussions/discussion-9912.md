---
number: 9912
title: "`useInfiniteQuery` does not refetch on mount even with `refetchOnMount: \"always\"` (but `useQuery` does)"
category: Q&A
created: 2025-11-25
url: "https://github.com/TanStack/query/discussions/9912"
upvotes: 1
comments: 1
answered: false
---

# `useInfiniteQuery` does not refetch on mount even with `refetchOnMount: "always"` (but `useQuery` does)

I'm seeing a strange difference between `useInfiniteQuery` and `useQuery` regarding `refetchOnMount`.

#### **Expected**
When a component unmounts (so the query has 0 observers) and then mounts again, `useInfiniteQuery` should refetch on mount when:

- The query is **stale**
- `refetchOnMount` is set to `"always"` (or `true`)
- `enabled: true`

This works correctly with `useQuery`.

#### **Actual**
With `useInfiniteQuery`:

- Devtools show:
  - The query becomes **inactive** (0 observers) after unmount → good.
  - After mount: 1 observer, `state = stale`, `refetchOnMount: "always"`, and `refetchOnWindowFocus: false`.
- However, **no network request** happens on mount.
- `fetchStatus` stays `"idle"`.
- Only window focus triggers a refetch (if enabled).

The same configu...

---

## Top Comments

**@TkDodo** [maintainer]:

show a minimal reproduction please. `useQuery` and `useInfiniteQuery` are both based on `useBaseQuery` so they are expected to behave the same in this regard.

My first guess is you’re using the same queryKey between an infinite query and a normal query and that errors out somewhere.