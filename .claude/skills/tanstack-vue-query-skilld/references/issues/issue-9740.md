---
number: 9740
title: Query V6 for Svelte warning on building
type: other
state: open
created: 2025-10-09
url: "https://github.com/TanStack/query/issues/9740"
reactions: 4
comments: 0
labels: "[package: svelte-query]"
---

# Query V6 for Svelte warning on building

### Describe the bug

When building a SvelteKit project on the latest version that includes the latest version (6) of Tanstack Query, I get the following warning:

```
"notifyManager" and "replaceEqualDeep" are imported from external module "@tanstack/query-core" but never used in "node_modules/@tanstack/svelte-query/dist/useMutationState.svelte.js", "node_modules/@tanstack/svelte-query/dist/useHydrate.js", "node_modules/@tanstack/svelte-query/dist/QueryClientProvider.svelte", "node_modules/@tanstack/svelte-query/dist/createInfiniteQuery.js", "node_modules/@tanstack/svelte-query/dist/createQuery.js", "node_modules/@tanstack/svelte-query/dist/createMutation.svelte.js", "node_modules/@tanstack/svelte-query/dist/createQueries.svelte.js" and "node_modules/@tanstack/svelte-query/dist/index.js".
```...