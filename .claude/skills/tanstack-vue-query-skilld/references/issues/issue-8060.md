---
number: 8060
title: `invalidateQueries` inconsistently cancels `fetchQuery`
type: other
state: open
created: 2024-09-15
url: "https://github.com/TanStack/query/issues/8060"
reactions: 3
comments: 6
labels: "[package: react-query]"
---

# `invalidateQueries` inconsistently cancels `fetchQuery`

### Describe the bug

`fetchQuery` may throw an `CancelledError { silent: true, revalidate: undefined }` under the following conditions:
- the query is stale (otherwise the fetch won't run).
- the query is invalidated at least one tick after the fetch started.
- **the query is in an `active` state. For example because a component with `useQuery` is still mounted.**

In the real world, this might happen in combination with `react-router`, when the user submits a form and then navigates to a new (or the same) page. In my case, we were updating a search param to close a modal after a form submission, which then triggered the loader function containing a `fetchQuery` call. We're also using a mutation observer[^1] to trigger invalidations, which is why the invalidation happened only after the n...