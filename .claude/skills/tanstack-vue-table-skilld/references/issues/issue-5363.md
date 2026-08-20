---
number: 5363
title: `getValue` cache not invalidating when `accessorFn` is updated
type: other
state: open
created: 2024-02-19
url: "https://github.com/TanStack/table/issues/5363"
reactions: 11
comments: 3
---

# `getValue` cache not invalidating when `accessorFn` is updated

### TanStack Table version

v8.12.0

### Framework/Library version

React v18.2.0

### Describe the bug and the steps to reproduce it

When the `accessorFn` for a column is updated to return a new value, the new value is never displayed in the table. Through a sophisticated series of `console.log`s, I discovered that when `getValue` is called on the rerender, the new `accessorFn` is never called, presumably due to caching on column id.

The use case is a column that displays the name of the person for the current row. We want the user to be able to choose whether to display first or last name first (e.g. `Tanner Linsley` or `Linsley, Tanner`). We could just change the column id when the `accessorFn` is updated, but then we lose the current sort state for that column, ie if the table is currently sorted by name, we want to stay sorted by name after the name format is changed.

Steps to reproduce:
1. Define a column where the `accessorFn` returns a different value based on some piece of state
2. Update that piece of state
3. The values in the column don't change

### Your Minimal, Reproducible Example - (Sandbox Highly Recommended)

https://stackblitz.com/edit/tanstack-table-rnjqkx?file=src%2Fmain.tsx

### Screenshots or Videos (Optional)

_No response_

### Do you intend to try to help solve this bug with your own PR?

No, because I do not know how

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.