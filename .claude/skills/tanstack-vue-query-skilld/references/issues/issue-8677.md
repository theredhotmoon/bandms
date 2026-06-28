---
number: 8677
title: Maximum update depth exceeded
type: bug
state: closed
created: 2025-02-19
url: "https://github.com/TanStack/query/issues/8677"
reactions: 17
comments: 27
resolvedIn: 5.66.4
labels: "[bug, package: react-query]"
---

# Maximum update depth exceeded

### Describe the bug

I am getting the error "Maximum update depth exceeded"

### Your minimal, reproducible example

https://stackblitz.com/~/github.com/yWilliamLima/test-error

### Steps to reproduce

It usually occurs after a while of running whenever changing pages/routes

### Expected behavior

Do not return this error

### How often does this bug happen?

Sometimes

### Screenshots or Videos




### Platform

OS: Windows 11
Browser: Chrome
Node: 22.12.0

### Tanstack Query adapter

None

### TanStack Query version

5.66.5

### TypeScript version

5.7.3

### Additional context

The error in the console does not occur locally, only in stackblitz
Maybe because of this error in the stackblitz console it doesn't happen, because it gives a refresh
Because it is a minimal example, it takes a while to occur, but in my project it occurs frequently

---

## Top Comments

**@TkDodo** [maintainer] (+2):

@juliusmarminge 5.66.4 was our hydration changes 

**@yWilliamLima** (+1):

I did some validations in my personal project where the error occurs frequently, where if I export the Page as async and use await in prefetchQuery the problem does not occur:

```
export default async function Page() {
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery({ ...getApiV1ActivitiesOptions() })
```

**@juliusmarminge** [maintainer]:

can anyone provide a minimal repro? I can look into this tonight but would help to have something simple to debug