---
number: 10097
title: Is this approch for passing queryOptions props ok?
category: Q&A
created: 2026-02-05
url: "https://github.com/TanStack/query/discussions/10097"
upvotes: 1
comments: 1
answered: true
---

# Is this approch for passing queryOptions props ok?

Is this approch ok or is a better approch for passing props to queryOptions 

Right now i m doing like this:
```js
# queries.ts
export const exampleQueryOptions = (
query?: APIQueryParams, 
options?: Partial<UseQueryOptions<PaginatedResponse<ExampleProps>>>
) => {
   ...options,
   queryKey: ['example', query],
    queryFn: () => getExample(query),
}

# components.tsx
const { data, isPending, isFetching, isRefetching } = useQuery(
 exampleQueryOptions({
    page: pagination.pageIndex,
    limit: pagination.pageSize,
    q: globalFilter,
  }, { placeholderData: keepPreviousData, }
 )
)

# component2.tsx
const { data, isPending, isFetching, isRefetching } = useQuery(
 exampleQueryOptions({
    q: globalFilter,
  }, { enabled: open, }
 )
)
```

---

## Accepted Answer

Hey @bylly1 !

Two things jumped out at me. You're not using the queryOptions helper. Your factory returns a plain object. That works at runtime, but you lose onz of the reasons this pattern exists, the type-safe inference. The queryOptions() helper looks like an identity function (it just returns what you give it), but it gives TypeScript the ability to infer the return type of queryFn, catch typos on option names, and flow types correctly into queryClient.getQueryData, prefetchQuery, etc...

The spread order can also be a little risky for me. In your factory you have ...options, then queryKey, then queryFn. This is actually fine as written because queryKey and queryFn come after and will always win. But the fact that you accept an options bag that can contain queryKey and queryFn is misleading for me. Someone calling it might think they can override those, but they can't. It's a confusing contract. More importantly, if someone accidentally flips the spread order during a refactor...