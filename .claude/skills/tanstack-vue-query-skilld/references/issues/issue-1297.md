---
number: 1297
title: Incorrect types for suspense
type: other
state: closed
created: 2020-11-19
url: "https://github.com/TanStack/query/issues/1297"
reactions: 20
comments: 17
---

# Incorrect types for suspense

**Describe the bug**
I have been playing around with v2 and v3 to experiment for a new project, and have noticed that the returned type for `useQuery` is incorrect with suspense. 

I am beginning to think there should be an aliased function with different return types for suspense.

**To Reproduce**
1. Write any code that uses `useQuery`
```
const { data } = useQuery<Todo[]>('todos', getTodos);
```

2. Notice that you can't use data in a typescript project without first checking if its undefined because the returned type is `Todo[] | undefined`


---

## Top Comments

**@TkDodo** [maintainer] (+11):

ah okay, got it. so what we would need to do, on type level, is return `T` rather than `T | undefined` if the option `suspense` was set to true?

**@boschni** [maintainer] (+7):

The only way to make this work is to create separate suspense hooks as the suspense option can be set globally. But I guess the data could still be undefined if `enabled` is set to false for example.

**@TkDodo** [maintainer]:

but isn't that expected though? In the first render cycle, your `status` will be `'loading'` so you have no `data` yet, thus `data` will be `undefined`. Only if your status goes to `'success'`, you will have `data` to use (at least this is how it is without suspense, not sure how suspense influences anything here).

Tagged unions discriminated by the `status` field were added in v3 - lots of discussions about that topic in this PR: https://github.com/tannerlinsley/react-query/pull/1108
and it was then done in this PR: https://github.com/tannerlinsley/react-query/pull/1247