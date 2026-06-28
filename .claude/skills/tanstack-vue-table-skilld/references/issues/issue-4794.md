---
number: 4794
title: unnecessary rerenders of every row and cell in examples/react/editable-data
type: other
state: open
created: 2023-04-03
url: "https://github.com/TanStack/table/issues/4794"
reactions: 20
comments: 20
---

# unnecessary rerenders of every row and cell in examples/react/editable-data

### Describe the bug

Every time one cell is edited in the examples/react/editable-data example, the entire table rerenders. If a user wants to render a large amount of rows, this strategy will start getting slow. At 50 rows in the example it takes 14.4 milliseconds to rerender the whole table with basic data. I've narrowed the unstable reference down to cell.getContext().

### Your minimal, reproducible example

https://github.com/TanStack/table/tree/main/examples/react/editable-data

### Steps to reproduce

1. Open react dev tools profiler
2. Start profiling
3. Click on a cell to edit it
4. Click off the cell
5. Stop the profiler
6. Check the results


### Expected behavior

Only the affected cell should rerender unless my other cells have a direct dependency on it. I've even tried creating memoized components all the way down to the cell.

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

Windows

### react-table version

8.8.5

### TypeScript version

_No response_

### Additional context

If this is something the library doesn't support then I think there should be a documentation section on it describing the pitfalls of rendering a large amount of rows and/or using complex cells.

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.

---

## Top Comments

**@alissaVrk** (+2):

hi @jasekiw, there are a few workarounds for this issue

the first reason all the cells re-render is that the state of the parent component,`App`, is changed - we can `React.memo` the cell to try and solve that.

that won't be enough because the cell context also changes, some things rightfully so, like the table and the row, because their data has changed.
and some things change without a seemingly good reason, like the `getValue` function.

so we stop using `flexRender` and implement our own function to extract what we need from the `cellContext` and pass to the cell component. 

h...

**@alissaVrk** (+2):

@Tsyklop [here is a sandbox with a simple example.
you will need some store to implement it.

there are other options for how to implement it, for example, you could pass a `useItem(string id) => Person` to the table and get the item per row instead of the cell

**@dennemark** (+3):

I just noticed the same behaviour in my table, when I start editing it. It really is a bummer. And I do not think, that @alissaVrk ´s solution should be the go-to way. It works, but it is something that should be fixed by tanstack/table imo...
 :/
