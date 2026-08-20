---
number: 4878
title: row selection not working for nested rows (`getSubRows`)
type: other
state: open
created: 2023-05-25
url: "https://github.com/TanStack/table/issues/4878"
reactions: 18
comments: 20
---

# row selection not working for nested rows (`getSubRows`)

### Describe the bug

row-selection in the group rows are not correctly reacting to their sub-rows row-selection state

### Your minimal, reproducible example

https://codesandbox.io/s/row-selection-sub-rows-kfgh2j

### Steps to reproduce

1. Go to https://codesandbox.io/s/row-selection-sub-rows-kfgh2j
1. Expand the first group row
1. Select the first sub-row
1.  Notice the parent row checkbox being "indeterminate"
    <img width="161" alt="image" src="https://github.com/TanStack/table/assets/87080313/3a9b664b-dd7a-4fdf-9db0-827003dab849">
1. Select the other 2 sub-rows in that same group
1.  Notice the parent row checkbox is "unchecked", when it should be "checked"
    <img width="202" alt="image" src="https://github.com/TanStack/table/assets/87080313/c0b84c25-dc97-4fa2-8f2a-28ccfd964db3">

### Probably the same issue:

1. Go to the same codesandbox: https://codesandbox.io/s/row-selection-sub-rows-kfgh2j
1. Expand the first group row
1. Select the checkbox from the column header
1.  Notice all rows (parent and children) are selected
    <img width="202" alt="image" src="https://github.com/TanStack/table/assets/87080313/a16956eb-57f3-4d2e-a380-7cdbd1b304d8">
1. Unselect the first sub-row of the expanded group
2.  Notice the parent row checkbox is stuck on "checked", when it should be "indeterminate"
    <img width="218" alt="image" src="https://github.com/TanStack/table/assets/87080313/1290bfb0-e10a-4b28-a0b4-fc86f3735181">

### Expected behavior

As a user, I expected the parent row to react to the row-selection status of its children, regardless on how they are selected/unselected:

- some sub-rows selected: parent row "indeterminate"
- no sub-rows selected: parent row "unchecked"
- all sub-rows selected: parent row "checked"

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

- Browser: N/A
- OS: N/A

Happens in codesandbox

### react-table version

...