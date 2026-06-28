---
number: 8249
title: `prefetchInRender` causes infinite render loop with deferred value if a promise rejects
type: other
state: open
created: 2024-11-04
url: "https://github.com/TanStack/query/issues/8249"
reactions: 3
comments: 1
labels: "[package: react-query]"
---

# `prefetchInRender` causes infinite render loop with deferred value if a promise rejects

### Describe the bug

When the query of a deferred component rejects, it falls into an infinite render loop. This is consistent and I have written a test case.

I was waiting to see if this was being caused by https://github.com/TanStack/query/issues/8219, but it appears not. Here's the test:

...