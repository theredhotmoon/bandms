---
number: 5497
title: Column visibility APIs do not work with column groups
type: other
state: open
created: 2024-04-18
url: "https://github.com/TanStack/table/issues/5497"
reactions: 13
comments: 5
---

# Column visibility APIs do not work with column groups

### TanStack Table version

v8.15.2

### Framework/Library version

React v8.15.2

### Describe the bug and the steps to reproduce it

When using column helpers to create a column group, consumers are able to provide `enableHiding: true` as a column def option. However:
1. `column.getToggleVisibilityHandler()` or `column.toggleVisibility` always updates the table's `columnVisibility` state to have a `false` entry for that column group's id
2. `column.getIsVisible()` always returns `true` for that column group

Ideally, the `getToggleVisibilityHandler`, `toggleVisibility`,  `getIsVisible`, and related `HeaderGroup` APIs could all be updated to support visibility toggling on column groups (which in turn would show or hide the children columns of that column group). Worst case, if toggling visibility of groups isn't something that can be supported, the `enableHiding` column def option could be removed from the column helpers API so it's not misleading to consumers.

### Your Minimal, Reproducible Example - (Sandbox Highly Recommended)

https://codesandbox.io/p/devbox/dry-river-9t7pg9

### Screenshots or Videos (Optional)

This video uses the linked Code Sandbox example which is almost identical to the example in the documentation, but instead of rendering the column leaves as visibility checkbox options it renders the column groups as options. When interacting with the checkbox options which should toggle the column visibility, the visibility state is always set to `false` and the checkbox is always checked.

https://github.com/TanStack/table/assets/10733340/f5a8fd29-0d71-494a-8190-a8588c1e6ccf



### Do you intend to try to help solve this bug with your own PR?

None

### Terms & Code of Conduct

...