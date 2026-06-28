---
number: 9681
title: Query DevTools is not isolated
type: question
state: open
created: 2025-09-24
url: "https://github.com/TanStack/query/issues/9681"
reactions: 0
comments: 1
labels: "[help wanted, package: query-devtools]"
---

# Query DevTools is not isolated

### Describe the bug

If we have multiple instances of Query DevTools, actions on one affect the other instance.

### Your minimal, reproducible example

https://stackblitz.com/edit/tanstack-react-query-dev-tools-issue?file=README.md

### Steps to reproduce

Open the example on the provided link

1. Open the devtools
1. Click on Query A and Query B to see both dev tools panels (each has its own query client)
1. Click on a query on Query A
1. Click on a query on Query B
   1. We see that the previous panel's details are hidden
1. Press trigger loading (or any other query option)
   1. We see the same query details on both panels now

### Expected behavior

Each query devtools should be isolated and actions in one should not affect the other one

### How often does this bug happen?

...