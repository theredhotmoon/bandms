---
number: 6310
title: `setQueryData()` should be persisted too, right?
type: other
state: closed
created: 2023-11-04
url: "https://github.com/TanStack/query/issues/6310"
reactions: 21
comments: 23
labels: "[package: query-persist-client-core]"
---

# `setQueryData()` should be persisted too, right?

### Describe the bug

I'm using the new `experimental_createPersister` like this:

```ts
import { experimental_createPersister, type AsyncStorage } from "@tanstack/query-persist-client-core";
import { get, set, del, createStore, type UseStore } from "idb-keyval";

function newIdbStorage(idbStore: UseStore): AsyncStorage {
  return {
    getItem: async (key) => await get(key, idbStore),
    setItem: async (key, value) => await set(key, value, idbStore),
    removeItem: async (key) => await del(key, idbStore),
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 30, // 30 seconds
      persister: experimental_createPersister({
        storage: newIdbStorage(createStore("db_name", "store_name")),
        maxAge: 1000 * 60 * 60 * 12, // 12 hours
      }),
    },
  },
});
```

But I just found out that if I call

```ts
const SetPlayerTeam = (team: Team) => {
  queryClient.setQueryData<Player>(
    ['player', team.playerId],
    (old) => old && { ...old, team }
  );
};
```

the in memory cache works (the `team` is added to `player`) but there is not `setItem()` call for this last `queryClient.setQueryData()`. If I reload the page the team is not on player anymore (unless I invalidate the player manually).

**I think this is wrong, because this change should be persisted too.**

_I'll create a reproduction if you think it might be useful._

### How often does this bug happen?

Every time

### Platform

Chrome.

### Tanstack Query adapter

svelte-query

### TanStack Query version

5.4.3

### TypeScript version

5

### Additional context

I'm using:

```json
"@tanstack/eslint-plugin-query": "5.0.5",
"@tanstack/query-persist-client-core": "5.4.3",
"@tanstack/svelte-query": "5.4.3",
"@tanstack/svelte-query-devtools": "5.4.3",
```

---

## Top Comments

**@TkDodo** [maintainer] (+3):

hmm, good question. Right now, the persister is just a wrapper around the `queryFn`. If the `queryFn` doesn't run, we don't persist. And with `setQueryData`, it doesn't run ...  

@DamianOsipiuk what are your thoughts here?

**@TkDodo** [maintainer] (+1):

There are a couple of things that lead me to think having `setQueryData` write to the persister as well is not a good idea:

- we can't make reads work

reads from the cache are synchronous, so `getQueryData` will never be able to return data from the cache. If we are thinking about a separate getter that somehow can do this, why not a setter as well?

- it will only work when the persister is defined globally

If you have `useQuery` with a persister passed to `useQuery` directly, `setQueryData` will not see it, so it won't write to the disk. That's an inconsistency I wouldn't expect....

**@miafoo** (+4):

Just some general input as I'm testing out the new `createPersister` in my app. Benchmarking before and after switching, the results are staggering - in some cases 8000x improvement in terms of speed! However I am experiencing some issues all tied to the fact that `setQueryData` not updating - here are some of them:

- I'm using `setQueryData` to add local-only metadata to certain results. This metadata is NOT available on the server side, and so refetching it would essentially remove the metadata and mess up the state of my data.
- My data (it's a timeline of sort) is stored "permanently" ...