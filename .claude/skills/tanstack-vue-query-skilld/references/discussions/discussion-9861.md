---
number: 9861
title: "Fetch data with `fetchNextPage` inside `useInfiniteQuery` even when `enabled: false`"
category: Q&A
created: 2025-11-11
url: "https://github.com/TanStack/query/discussions/9861"
upvotes: 1
comments: 1
answered: false
---

# Fetch data with `fetchNextPage` inside `useInfiniteQuery` even when `enabled: false`

```tsx
  const [page, setPage] = useState<number>(1);
  const { data, fetchNextPage } = useInfiniteQuery({
    queryKey: ['products'],
    queryFn: ({ pageParam }) => {
      setPage(pageParam);
      return httpRequest({
        baseURL: 'https://jsonplaceholder.typicode.com',
        url: '/todos',
        params: {
          _limit: 10,
          _start: pageParam * 10,
        },
      });
    },
    initialPageParam: 1,
    getNextPageParam: () => {
      return page + 1;
    },
    enabled: false,
  });

  return (
    
      <Button  onClick={() => fetchNextPage()}>
        {t('brand')}
      </Button>
  );
```

In the code above, why is the fetch operation performed when I call the `fetchNextPage` function even though `enabled` is set to `false`?
Is t...

---

## Top Comments

**@TkDodo** [maintainer]:

just like `refetch`, those imperative functions returned from `useInfiniteQuery` bypass enabled. You have to _not_ call them when the query is `enabled: false`. I guess you’d want to disable the button. Otherwise, pressing the button would do nothing if `fetchNextPage()` just did nothing internally.