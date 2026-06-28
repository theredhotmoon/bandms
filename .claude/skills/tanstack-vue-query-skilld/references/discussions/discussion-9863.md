---
number: 9863
title: Network-first, persisted cache fallback strategy using React Query
category: Q&A
created: 2025-11-11
url: "https://github.com/TanStack/query/discussions/9863"
upvotes: 1
comments: 1
answered: true
---

# Network-first, persisted cache fallback strategy using React Query

Hello 

I’m working on a React Native app and I would like to implement the following strategy:
- The app always tries the API first (no fallback at this point)
- If the request fails (offline or error), it falls back to persisted data
- When the network succeeds again, new data overrides the old cache
- The cache is persisted across app restarts

Is `persistQueryClient` adapted for this use case? 

---

## Accepted Answer

**@TkDodo** [maintainer]:

then you need to build this yourself, likely by doing try/catch in the queryFn and then read from the fallback cache when you get an error.