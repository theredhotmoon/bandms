---
number: 3790
title: `yarn add @tanstack/react-query` responds with 404
type: other
state: closed
created: 2022-07-08
url: "https://github.com/TanStack/query/issues/3790"
reactions: 20
comments: 13
---

# `yarn add @tanstack/react-query` responds with 404

### Describe the bug

Running `yarn add @tanstack/react-query` per docs yields a 404 error.

<img width="567" alt="image" src="https://user-images.githubusercontent.com/627290/178082137-39fb5a52-0ad3-49c0-914b-113371318558.png">



### Your minimal, reproducible example

n/a

### Steps to reproduce

`yarn add @tanstack/react-query`

### Expected behavior

Should work

### How often does this bug happen?

_No response_

### Screenshots or Videos

_No response_

### Platform

n/a

### react-query version

n/a

### TypeScript version

_No response_

### Additional context

_No response_

---

## Top Comments

**@Kayyow** (+37):

Maybe we should update the installation docs because it state that you can install the package via `@tanstack/react-query` which isn't currently working.

**@TkDodo** [maintainer] (+8):

It hasn't been released on npm yet, the docs redirect was a mistake. Please be patient and use this in the meantime:
https://github.com/TanStack/query/issues/3790#issuecomment-1179431860

**@TkDodo** [maintainer] (+1):

I know this is really confusing, so let me try to clear it up:

for now, all you need is `npm i react-query@beta` if you want v4 or `npm i react-query` if you want v3.

Both of them work the same way:

```
import { useQuery } from 'react-query'
import { ReactQueryDevTools } from 'react-query/devtools'
```

devtools are bundled with the lib!

---

once we rollout tanstack query, it will be:

```
npm i @tanstack/react-query
npm i @tanstack/react-query-devtools
```

two separate packages, imported separately:

```
import { useQuery } from '@tanstack/react-query'
import { ReactQueryDevTools } from '@tanstack/react-query-devtools'
```...