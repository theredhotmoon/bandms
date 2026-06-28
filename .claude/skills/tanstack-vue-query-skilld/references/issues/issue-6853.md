---
number: 6853
title: "eslint-plugin-query: exhaustive-deps error not triggered when dependency is nested inside then/catch"
type: other
state: open
created: 2024-02-07
url: "https://github.com/TanStack/query/issues/6853"
reactions: 4
comments: 22
labels: "[package: eslint-plugin-query]"
---

# eslint-plugin-query: exhaustive-deps error not triggered when dependency is nested inside then/catch

### Describe the bug

exhaustive-deps triggers only when we use some dependency in non-nested code, but while using then/catch - it cannot detect used dependency.

### Your minimal, reproducible example

-

### Steps to reproduce


If we nest it in then/catch callbacks, error is not showing.
I know we can use "t" outside whole useQuery hook, it's just for demo. Any other function which would be part of fetchable logic won't trigger error.

### Expected behavior

Error should be triggered like in example when we use "t" dependency outside then/catch clauses:



### How often does this bug happen?

...