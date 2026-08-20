---
number: 9869
title: TypeScript error with context in useMutation optimistic update (Property 'snapshot' does not exist on type '{}')
category: Q&A
created: 2025-11-13
url: "https://github.com/TanStack/query/discussions/9869"
upvotes: 1
comments: 1
answered: false
---

# TypeScript error with context in useMutation optimistic update (Property 'snapshot' does not exist on type '{}')

Description:

I'm trying to implement an optimistic update using react-query's useMutation, where I temporarily update the userSession data and rollback on error. The mutation itself works, but TypeScript complains when I try to access context.snapshot inside onError.

Code:

...

---

## Top Comments

**@TkDodo** [maintainer] (+1):

It’s because `UseMutationOptions` has 4 type parameters, and since you specify `options` like this:

```
UseMutationOptions<MfaVerifyMutationFnResult, AxiosErrorRes, MfaVerifyMutationFnBody>
```

the 4th type parameter falls back to its default value. Take a look at `mutationOptions` instead of rolling your own.

also please put that in a typescript playground so it’s easier to help.