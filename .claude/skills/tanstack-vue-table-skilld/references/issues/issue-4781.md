---
number: 4781
title: Pagination and Row Selection
type: other
state: open
created: 2023-03-29
url: "https://github.com/TanStack/table/issues/4781"
reactions: 11
comments: 10
---

# Pagination and Row Selection

### Describe the bug

I've noticed differences in how selection of all rows is treated when using standard vs. server-side pagination. 

As we see in the official example here: https://tanstack.com/table/v8/docs/examples/react/row-selection toggling "all rows selection" affects truly **all** rows in the table. The rows are present from the start, so we we don't need to define `getRowId`, everything is fine.

But when we use server-side pagination, we'd need to provide the `getRowId` since we can't rely on the raw row index since it resets for every page (I suppose that's the reason?). Otherwise we'll notice a side-effect like here https://github.com/TanStack/table/issues/4555 or https://github.com/TanStack/table/discussions/3619. 
However, with `getRowId` defined the `table.getToggleAllRowsSelectedHandler()` affects only rows on the current page (even though there is a special handler for that? This one `table.getToggleAllPageRowsSelectedHandler`?). Furthermore, the `table.getIsAllRowsSelected()` also returns true when just the entries on the current page are selected.

So I'm wandering, if this behaviour is intended, then why when using the "standard" pagination the `table.getToggleAllRowsSelectedHandler()` affects all pages (and with server-side pagination only the current page)? How can I achieve the same behaviour when using the server-side pagination?

I "created" a codesandbox by merging the two examples: https://tanstack.com/table/v8/docs/examples/react/row-selection and https://tanstack.com/table/v8/docs/examples/react/pagination-controlled

### Your minimal, reproducible example

https://codesandbox.io/p/sandbox/tanstack-table-controlled-pagination-row-selection-fbkc6x?file=%2Fsrc%2Fmain.tsx&selection=%5B%7B%22endColumn%22%3A8%2C%22endLineNumber%22%3A151%2C%22startColumn%22%3A8%2C%22startLineNumber%22%3A151%7D%5D

### Steps to reproduce

Using the linked Codesanbox:

#### "Bug" 1
1.  Check the "Select All" checkbox
2. Go to another pa...