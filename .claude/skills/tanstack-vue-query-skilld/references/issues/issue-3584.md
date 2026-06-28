---
number: 3584
title: "[Beta] Disabled query has `isLoading: true` property"
type: other
state: closed
created: 2022-05-03
url: "https://github.com/TanStack/query/issues/3584"
reactions: 41
comments: 41
---

# [Beta] Disabled query has `isLoading: true` property

### Describe the bug

In `react-query@beta` version has strange behaviour. By default query that has `enabled: false` option has `isLoading: true` property (see code sandbox for details). In stable release `react-query@^3` is has `isLoading: false`. I didn't find any notes about this update in change logs so it seems like a bug.

### Your minimal, reproducible example

https://codesandbox.io/s/eager-bell-epuvfi?file=/src/App.js

### Steps to reproduce

Define simple query with `enabled: false` option

### Expected behavior

Query should have `isLoading: false`

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

Any

### react-query version

4.0.0-beta.7

### TypeScript version

Not relevant

### Additional context

_No response_

---

## Top Comments

**@olan-go2** (+366):

This is messed up. If the enabled = false, isLoading should be in false as well

**@caweidmann** (+22):

What I ended up doing as quick and dirty workaround is the following:
```
const enabled = false
const { isLoading: isLoad } = useQuery(['some-key'], someMethod, { enabled })
const isLoading = isLoad && enabled
```

**@edemaz** (+29):

This is really messed up. On big repo that relies heavily on isLoading state, it is a nightmare upgrading to v4.
