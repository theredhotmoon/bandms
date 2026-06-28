---
number: 5026
title: Can't perform a React state update on a component that hasn't mounted yet
type: other
state: open
created: 2023-08-14
url: "https://github.com/TanStack/table/issues/5026"
reactions: 34
comments: 31
---

# Can't perform a React state update on a component that hasn't mounted yet

### Describe the bug

Error received when navigating to a table using `getGroupedRowModel()` such as:

```ts
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
  });
```

As seen in this example, navigating to the basic table works fine where as navigating to the grouped table produces an error in the console. The only difference between the two is `getGroupedRowModel()`.
 
I am using the code from the examples pretty much as is (stripped down for simplicity).

### Your minimal, reproducible example

https://github.com/tacomanator/tanstack-table-unmounted

### Steps to reproduce

1. Clone example, install dependencies, and run
2. While viewing the console, navigate to the grouped table
3. Observe error

### Expected behavior

No error output

### How often does this bug happen?

Every time

### Screenshots or Videos

https://github.com/TanStack/table/assets/63794/30edbbcf-8f7e-459f-b624-b7d82aac3f0a


### Platform

macOS, Chrome 115.0.5790.170 arm64

### react-table version

8.9.3

### TypeScript version

5.1.6

### Additional context

_No response_

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.

---

## Top Comments

**@timredband** (+18):

I think it has something to do with pagination. When you add `getGroupedRowModel` it ends up calling setPagination in the render and that ends up calling `setState`. 

So if you set `onPaginationChange` in the `useReactTable` definition to `onPaginationChange: () => undefined` then the error also goes away. 

**@VitAndrGuid** (+5):

This also happens on `getFacetedUniqueValues`

**@andrelillvede** (+5):

I am having the same problem in version 8.9.1 when I call table.getRowModel() to conditionally render rows in tbody and I can confirm that it probably has something to do with getGroupedRowModel.

If i remove getGroupedRowModel: getGroupedRowModel() from the hook the error disappears.