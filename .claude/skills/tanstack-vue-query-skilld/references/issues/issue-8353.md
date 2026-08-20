---
number: 8353
title: Polling Stops with refetchIntervalInBackground and Retry When Tab Is Inactive
type: other
state: open
created: 2024-11-26
url: "https://github.com/TanStack/query/issues/8353"
reactions: 3
comments: 5
labels: "[package: query-core]"
---

# Polling Stops with refetchIntervalInBackground and Retry When Tab Is Inactive

### Describe the bug

I am creating this issue based on the discussion here.

When using `refetchIntervalInBackground` with `retry`, the retry mechanism fails to execute if the browser tab is inactive. I have the following configuration for my React Query setup:

```javascript
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 sec
      networkMode: "always",
    },
    mutations: {
      networkMode: "always",
    },
  },
});
```

...