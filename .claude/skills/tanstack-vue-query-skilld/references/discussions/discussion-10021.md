---
number: 10021
title: How does refetchOnReconnect really works, in particular when combined with sync storage persister
category: Q&A
created: 2026-01-08
url: "https://github.com/TanStack/query/discussions/10021"
upvotes: 1
comments: 2
answered: false
---

# How does refetchOnReconnect really works, in particular when combined with sync storage persister

Hello Everyone.

I work on an app where we are careful to limit our api calls. General behavior we wish for is to cache data locally for as long as possible, and thus we use tanstack along with syncStoragePersister in order to save the data in the localstorage. If you refresh your browser, we wish to pull the data from the localstorage for as long as the data isn't considered stale, but then refetch on refresh if the data is stale when opening the app. 

I thought setupping my query with `refetchOnReconnect: true`, and every other refetch option to false would lead to this behavior. It however does not refetch the data from the api when the page reloads, and it serves the stale data from the localstorage instead. If I instead use `refetchOnMount`, the data is indeed refetched if i refr...

---

## Top Comments

**@TkDodo** [maintainer]:

reconnect is for when you lose network connection (going offline) and then re-gaining it (going online again).

> If you refresh your browser, we wish to pull the data from the localstorage for as long as the data isn't considered stale, but then refetch on refresh if the data is stale when opening the app.

you can keep all the flags off and just do a `queryClient.refetchQueries({ stale: true })` in the `onSuccess` callback of the `PersistQueryClientProvider`.

**@sunnypatell**:

great question, and it's a common source of confusion because the name `refetchOnReconnect` sounds like it could mean "reconnect to the app" or "reconnect to the page" but it actually means something much more specific.

## what `refetchOnReconnect` actually does

`refetchOnReconnect` fires **only** when the browser transitions from offline to online. under the hood, tanstack query's `onlineManager` listens to the browser's native `window.addEventListener('online', ...)` event. when that event fires, it calls [`query.onOnline()`](ht...