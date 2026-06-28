---
number: 9903
title: Global loading state when switching organization with cookie-based auth (React Query v5)
category: Q&A
created: 2025-11-24
url: "https://github.com/TanStack/query/discussions/9903"
upvotes: 1
comments: 3
answered: false
---

# Global loading state when switching organization with cookie-based auth (React Query v5)

Hi everyone,
We have a multi-organization dashboard. Authentication is cookie-based and when the user switches organization we call this endpoint:
TypeScriptPOST /v1/auth/switch-organization
{ organization_id: "123", use_cookie: true }
This endpoint sets a new session cookie on the browser.
The problem:
All our data is fetched with React Query (useQuery) in many different pages/components.
When the user clicks "Switch organization":

I need to show loading (skeleton/spinner) immediately in the entire app (even on pages that are already open in background tabs).
I must cancel/invalidate all previous queries so they don’t refetch with the old cookie.
Queries must refetch only after the new cookie is fully set in the browser.
If I call resetQueries / invalidateQueries before the P...

---

## Top Comments

**@TkDodo** [maintainer]:

you can show a global loading indicator with `useMutationState` to just check if your specific mutation is in progress

**@matinsekhavat**:

i think we need sth like this 

BASED ON DOCS:

```
[queryClient.invalidateQueries](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientinvalidatequeries)
The invalidateQueries method can be used to invalidate and refetch single or multiple queries in the cache based on their query keys or any other functionally accessible property/state of the query. By default, all matching queries are immediately marked as invalid and active queries are refetched in the background.

If you do not want active queries to refetch, and simply be marked as invalid, you can use the refetchType: 'none' option.

```...

**@matinsekhavat**:

 try {
            await queryClient.resetQueries({
              predicate: (query) =>
                !query.queryKey.some((key) =>
                  key?.toString().toLowerCase().includes('organizations')
                ),
            });

            const queries = queryClient.getQueryCache().findAll({
              predicate: (query) =>
                !query.queryKey.some((key) =>
                  key?.toString().toLowerCase().includes('organizations')
                ),
            });

            for (const query of queries) {
              if (query.isActive()) {
...