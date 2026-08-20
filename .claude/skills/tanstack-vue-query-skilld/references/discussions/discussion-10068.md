---
number: 10068
title: How to make prefetched queries don't retry on error?
category: Q&A
created: 2026-01-23
url: "https://github.com/TanStack/query/discussions/10068"
upvotes: 1
comments: 1
answered: true
---

# How to make prefetched queries don't retry on error?

I would like to understand how I can:
1. Prefetch a query in a RSC 
2. If that query fails, I would like to not run any operations whatsoever. I would like for any client-side mounted queries to not trigger refetches at all 


```tsx
const ApplicationLayout = ({
	children,
}: LayoutProps<"/app"> | LayoutProps<"/admin">) => {

	prefetch([
		trpc.admin.me.queryOptions(undefined, {
			retry: false,
		}),
	]);

	return (
		<HydrateClient> // Btw HydrateClient is just this: https://github.com/t3-oss/create-t3-turbo/blob/main/apps/nextjs/src/trpc/server.tsx#L35-L42
			{children}
		</HydrateClient>
	);
};

export default ApplicationLayout;
```

And then I have a hook that is used in almost ALL pages (except for the auth page for example):

```ts
"use client"

export const useAdminUserData = () => {
	const trpc = useTRPC();

	const query = useQuery(
		trpc.admin.me.queryOptions(undefined, {
			enabled: false, //Notice the enabled:false and the retry: false
			retry: false
		}),
	);
	
	//...More implementation here. (I have custom logic to manually refetch this data)
	return query;	
}
```...

---

## Accepted Answer

**@TkDodo** [maintainer]:

it seems like you’re making use of streaming by sending the promise from the server to the client. With this approach, the query on the client picks up the promise from the server. If it fails, retries apply.

the options taken into account here are the ones from when the query was created via hydration, not the one from `useQuery` since we can’t know if and whene the query that gets sent from the server will be picked up on the client, and we also don’t know which options will be applied then.

to set those options (`retry: false` is likely the one that matters) you can either set a global default on the `queryClient`, or set it for hydration only on the `HydrationBoundary` with:

```
<HydrationBounary
  state={dehydrate(queryClient)}
  options={{ defaultOptions: { queries: { retry: false } } }}
/>
```

