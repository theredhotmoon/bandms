---
number: 9948
title: useSuspenseQuery shows loading state after the first error, and triggers ErrorBoundary for the second
category: Q&A
created: 2025-12-05
url: "https://github.com/TanStack/query/discussions/9948"
upvotes: 1
comments: 1
answered: false
---

# useSuspenseQuery shows loading state after the first error, and triggers ErrorBoundary for the second

Hi @TkDodo ! :)
Not sure if this is a bug or just something that i completely misunderstand  

We have various screens in our React Native app that load data from an API and use polling (`refetchInterval`) to keep this data up to date. We've seen some odd things so i'm debugging what is happening exactly when error occur. I'm using this code to debug:
```ts
  let c = 0 // Global variable, outside of React Component
  
  // React component
  const { data: foo, error: fooError } = useSuspenseQuery({
    queryKey: ['foo'],
    refetchInterval: 5000,
    queryFn: async () => {
      c++
      console.log('foo called', c)
      await new Promise(resolve => setTimeout(resolve, 1500))

      // if (c % 4 === 0) { // 1 error
      if (c % 4 === 0 || c % 4 === 1) { // 2 consecutive errors
        console.log('foo error')
        return Promise.reject(new Error('foo error internal'))
      }
      console.log('foo success')
      return Promise.resolve('foo')
    },
  })
  console.log({ foo, fooError })
```...

---

## Top Comments

**@TkDodo** [maintainer] (+1):

> I would expect, after reading the docs and your comments, that any existing data is always shown when refetching/polling fails.

Yes, I’d expect that too. Can you create a minimal reproduction with stackblitz please?