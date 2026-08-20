---
number: 9899
title: Why does TContext in useMutation default to {} and not infer from onMutate return type?
category: Q&A
created: 2025-11-23
url: "https://github.com/TanStack/query/discussions/9899"
upvotes: 1
comments: 2
answered: true
---

# Why does TContext in useMutation default to {} and not infer from onMutate return type?

Hi, I’m experimenting with optimistic updates using useMutation in React Query (v5).
One thing I noticed is that when I return a context object from onMutate, the type of that context in onError is {} unless I explicitly define the 4th generic of UseMutationOptions.

Example:
```ts
return useMutation<Result, Error, Variables>({
  onMutate: async () => {
    const snapshot = queryClient.getQueryData(["user"]);
    return { snapshot };
  },
  onError: (err, variables, context) => {
    // ❌ context is {} here unless I specify <..., ..., ..., { snapshot: User }>
  },
});
```

I expected the context type to be inferred from the return of onMutate, but it seems React Query does not infer this.

Is there a recommended pattern for typing mutation context?
Do I always have to ex...

---

## Accepted Answer

You need to explicitly specify the 4th generic of useMutation (TContext).
React Query does not infer the return type of onMutate, so without providing TContext, the type defaults to {}, which is why context.snapshot gives a TS error.

return useMutation<
  Result,
  Error,
  Variables,
  { snapshot: User | undefined }
>({
  onMutate: async () => {
    const snapshot = queryClient.getQueryData(["user"]);
    return { snapshot };
  },

  onError: (err, variables, context) => {
    if (context?.snapshot) {
      queryClient.setQueryData(["user"], context.snapshot);
    }
  },
});

 Why this happens

UseMutationOptions has 4 generics:
TData, TError, TVariables, TContext

If you only provide 3, TContext falls back to its default:

TContext = unknown   // or treated as {}


React Query currently does not infer TContext from onMutate,
so the correct usage is to explicitly define the 4th generic when using optimistic updates.

This is the recommended and type-...