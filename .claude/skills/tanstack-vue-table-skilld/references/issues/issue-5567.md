---
number: 5567
title: Table doesn’t re-render with new React Compiler + React 19
type: other
state: open
created: 2024-05-18
url: "https://github.com/TanStack/table/issues/5567"
reactions: 45
comments: 29
labels: "[v8, react]"
---

# Table doesn’t re-render with new React Compiler + React 19

### TanStack Table version

v8.17.3

### Framework/Library version

React 19 + React Compiler

### Describe the bug and the steps to reproduce it

In the repo provided, run `bun install` and then `bun dev`. 

Then, add some text to the input and click add. Observe that the table doesn’t re-render when the data passed in has changed (`table.getRowModel().rows` doesn’t seem to be updated). 

### Your Minimal, Reproducible Example - (Sandbox Highly Recommended)

https://github.com/erikshestopal/react-compiler-bug/blob/a92305ca44ee81b6d7ece76c96aacf163fe83970/src/App.tsx#L38

### Screenshots or Videos (Optional)

_No response_

### Do you intend to try to help solve this bug with your own PR?

None

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.

---

## Top Comments

**@KevinVandy** [maintainer] (+20):

Yep, use no memo on table components for now. A v9 alpha branch was recently created where we will focus on version bumping the peer dependencies for each framework that needs it.

**@ssynowiec** (+9):

I've the same problem with Next.js 15 & React 19 & Tanstack Table 8.20.5

`use no memo` in table component solves the problem.

**@jonahallibone** (+6):

This is unsurprising. This library (which I love) has been complicated to optimize since at least v7. They core instance returned from `useReactTable` doesn't rerender as one would expect in React, which means that the memoiziation that the compiler applies certainly breaks this library. I wouldn't expect a fix until v9. 