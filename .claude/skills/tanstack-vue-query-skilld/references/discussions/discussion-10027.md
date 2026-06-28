---
number: 10027
title: "Investigating #8825: prefetchInfiniteQuery SSR Hydration Issue"
category: Q&A
created: 2026-01-11
url: "https://github.com/TanStack/query/discussions/10027"
upvotes: 1
comments: 1
answered: false
---

# Investigating #8825: prefetchInfiniteQuery SSR Hydration Issue

Hi @TkDodo,
I've been looking into #8825 and think I found the root cause. Want to run my approach by you before submitting a PR.

## Setup I tested
Server prefetch: fails with 500
Client fetch: succeeds
Result: Works! Data shows up after client retry

## What's happening
1. **Type info gets lost during hydration**
   DehydratedQuery doesn't track if it's an infinite query
2. **infiniteQueryBehavior not attached**
   Regular queries work, but infinite queries lose their behavior
3. **Failed promise blocks retry**
   The rejected promise prevents client-side refetch

## Proposed fix

1. Add a queryType field to track infinite queries:
```typescript
interface DehydratedQuery {
  queryType?: 'infiniteQuery' | 'normal'
}
```

2. Detect during dehydration:
```typescript
const isInfinite = 'initialPageParam' in query.options
const queryType = isInfinite ? 'infiniteQuery' : 'normal'
```...

---

## Top Comments

**@TkDodo** [maintainer] (+1):

yeah I think it should work, let’s give it a go with another PR.