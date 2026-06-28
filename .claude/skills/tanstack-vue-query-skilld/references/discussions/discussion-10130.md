---
number: 10130
title: `persistQueryClient` does not synchronize cache invalidation across isolated JavaScript contexts
category: Q&A
created: 2026-02-13
url: "https://github.com/TanStack/query/discussions/10130"
upvotes: 1
comments: 0
answered: false
---

# `persistQueryClient` does not synchronize cache invalidation across isolated JavaScript contexts

## Problem

In our React Native application, each screen in the Stack Navigator renders a **separate WebView** loading a Next.js app. Since each WebView runs its own JavaScript runtime, each one instantiates its own `QueryClient`.

When a mutation in one screen invalidates a query, the invalidation **does not propagate** to the `QueryClient` in another screen — even when using `persistQueryClient`.

### Steps to Reproduce

1. **Screen A** fetches a review list via `useQuery`. Data is cached in `QueryClient A`.
2. **Screen B** is pushed onto the stack. The user deletes a review via mutation.
3. Screen B calls `queryClient.invalidateQueries({ queryKey: ['reviews'] })`.
4. Screen B is popped. **Screen A** becomes visible again — but still displays the stale list including the delet...