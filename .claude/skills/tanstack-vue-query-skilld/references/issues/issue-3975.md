---
number: 3975
title: useQuery return always isLoading with true when enabled is false
type: other
state: closed
created: 2022-08-03
url: "https://github.com/TanStack/query/issues/3975"
reactions: 20
comments: 37
---

# useQuery return always isLoading with true when enabled is false

### Describe the bug

When I created `useQuery` with `enabled: false` option, `isLoading` variable is always `true`.

### Your minimal, reproducible example

https://codesandbox.io/s/react-query-enabled-7u58d5-7u58d5

### Steps to reproduce

1. Create simple query by use `useQuery`,
2. Add `enabled: false` into options,
3. Check state for `isLoading`.

### Expected behavior

State `isLoading` is `false`.

### How often does this bug happen?

Every time

### Screenshots or Videos




### Platform

- OS: Windows 11 22H2,
- Browser: Chrome
- Version: 103

### react-query version

4.0.10

### TypeScript version

4.7.4

### Additional context

_No response_

---

## Top Comments

**@TkDodo** [maintainer] (+5):

Not that your comment would deserve another answer, but see: https://tanstack.com/query/v4/docs/guides/queries#why-two-different-states

**@egorovsa** (+8):

@TkDodo I am sorry for the sharp expression like ""Are you serious?"  at the same time I am not alone with this issue that faced a bug after update and was very upset after that.

Ok now about my case. This case is extremely simple 

```
const { isLoading, data: currentUser, refetch, error } = useQuery(
    ['currentUser'],
    () => UsersApi.getCurrentUser(),
  );

  const { isLoading: isTokenLoading } = useQuery(
    ['tokenCoreApp'],
    () => UsersApi.getToken(),
    {
      enabled: Boolean(currentUser),
      onSuccess: handleTokenSuccess,
    }
  );

  const loading = isLoading || isTokenLoading;
```...

**@TkDodo** [maintainer] (+1):

Yes, in hindsight, I also think that pending / success / error would be the better naming for the states. We thought about it, but decided that it would break too many cases / cause troubles upgrading.

If you have previously checked for the `idle` state explicitly, you now have to combine two checks. We can talk about exposing an extra derived flag if we find a good name for it.

often, you can:
- check for data availability over checking statuses, as this will make your behavior more predictable. I have a blogpost on that topic: https://tkdodo.eu/blog/status-checks-in-react-query
- for...