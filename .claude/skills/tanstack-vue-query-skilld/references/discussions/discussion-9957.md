---
number: 9957
title: Should select on Suspense Query throw errors?
category: Q&A
created: 2025-12-08
url: "https://github.com/TanStack/query/discussions/9957"
upvotes: 2
comments: 2
answered: true
---

# Should select on Suspense Query throw errors?

Dear TanStack team,

I have a question connected to React Suspense Query `select` function and how throwing `error` inside of it is handled.

Lets look at the following example:
```ts
type ResolvedDataType = Record<number, string>;

const selectItemById = (id: number) => (data: ResolvedDataType) => {
	const item = data[id];
	if (!item) {
		throw new Error('Item not found');
	}
	return item;
};

const ComponentA = () => {
	const externallyControlledId = 2;

	const { data } = useSuspenseQuery({
		queryKey: ['query-key'],
		queryFn: async () => Promise.resolve<ResolvedDataType>({ 1: 'one' }),
		select: selectItemById(externallyControlledId),
	});

	return <p>{data}</p>;
};

```

I would expect the `data` to always be a `string`, this is why I used suspense.

Bu...

---

## Accepted Answer

**@TkDodo** [maintainer]:

if you have a `selectError`, we will put the observer into error state:

https://github.com/TanStack/query/blob/f15b7fcc01e995ab8835f1b1cc82ebb472c1ff64/packages/query-core/src/queryObserver.ts#L547-L552

then, the react integration will throw that error to the error boundary:

https://github.com/TanStack/query/blob/f15b7fcc01e995ab8835f1b1cc82ebb472c1ff64/packages/react-query/src/useBaseQuery.ts#L124-L142

you can clearly see that if you take your own example and put it in a sandobx:

https://stackblitz.com/edit/tanstack-query-zmlk4cr7?file=src%2Findex.tsx&preset=node