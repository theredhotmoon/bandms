---
number: 10070
title: What is the good way to use suspense with both standard and infinite queries (without waterfalls)?
category: Q&A
created: 2026-01-25
url: "https://github.com/TanStack/query/discussions/10070"
upvotes: 1
comments: 2
answered: true
---

# What is the good way to use suspense with both standard and infinite queries (without waterfalls)?

First thanks a lot for this marvelous library!

I know the best way would be to use a loader at router level, but in not router related application parts, what is the good way to use suspense with both infinite and standard queries ?
- `useSuspenseQueries` is great, but it doesn't handle infinite queries.

- This creates a waterfall:
```typescript
const result = useSuspenseQuery(myQueryOptions)
const infiniteResult = useSuspenseInfiniteQuery(myInfiniteQueryOptions)
```

- Splitting my code in two sibling components also creates a waterfall with React 19.2 (I thought React 19 RC waterfall problem on sibling components was solved but apparently not, or I did something wrong (my sibling components are deeply nested under their parent with Suspense, it may come from that)):

- I e...

---

## Accepted Answer

**@TkDodo** [maintainer]:

splitting into siblings should work, if not, please show a reproduction.

> I ended up using React.use with ensure(Infinite)QueryData
> Any better way?

We have a `usePrefetchQuery` and a `usePrefetchInfiniteQuery` hook you could use instead.