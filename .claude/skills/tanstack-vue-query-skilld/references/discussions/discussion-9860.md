---
number: 9860
title: Return type of combined `useQueries` in `vue-query`
category: Q&A
created: 2025-11-10
url: "https://github.com/TanStack/query/discussions/9860"
upvotes: 2
comments: 1
answered: true
---

# Return type of combined `useQueries` in `vue-query`

In `vue-query`, the `useQuery` hook returns an _object_ of `Ref`s that is easy to destructure from (similar to React examples), without losing any reactivity.

However, when using the `useQueries` hook together with the `combine` callback, the return type becomes a `Ref` itself. This makes it tricky to work with.

Consider the following example:
```
❌ Properties data, isPending, refetch, does not exist on type `ReadOnly<Ref>...`
const { data, isPending, refetch } = useQueries({
  queries: [
      ...
  ],
  combine: (results) => {
    return {
      data: results.flatMap((result) => result.data),
      isPending: results.some((result) => result.isPending),
      refetch: () => results.forEach((result) => result.refetch()),
    }
  }
})
```

Because it returns a `Ref`, ...

---

## Accepted Answer

Ref wrapper around result is mostly for Vue 2 compatibility as the original resulting value is an array. 
We will be able to remove it in next major version.

As for what is returned from `combine` it's up to you as data shape might be virtually anything, so we cannot assume anything.
You would potentially have to call `toRefs` on the return value to be able to safely destructure result without looking reactivity.