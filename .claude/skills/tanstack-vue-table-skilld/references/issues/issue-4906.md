---
number: 4906
title: Column pinning inconsistence
type: other
state: open
created: 2023-06-09
url: "https://github.com/TanStack/table/issues/4906"
reactions: 12
comments: 0
---

# Column pinning inconsistence

### Column pinning inconsistency

I'm trying to implement stickiness of table columns. Something similar to https://www.npmjs.com/package/react-table-sticky but for the current version. 

I was trying to define `position: sticky` and manipulate `left` and `right` properties based on that where given column is placed. 

But it seems like if I split one section into two (name section on the screenshot) I cannot "set" "Name" section to the right because it has ALWAYS set "left", even if I split that into two sides.

Why is that?

Is there other option to have "sticky" functionality? Like here: https://codesandbox.io/s/sweet-cori-gl81g


### Your minimal, reproducible example

https://tanstack.com/table/v8/docs/examples/react/column-pinning

### Steps to reproduce

1. Go to docs page
2. Click on "Last Name" right arrow.
3. Look at the "Name" section on the right, it has arrow like it was pinned to the left, but is on the right.

### Expected behavior

I expect each section, even if its the same, should have own positioning ('left', 'right'). Currently one section has only one positioning, even if its split.

### How often does this bug happen?

Every time

### Screenshots or Videos




### Platform

macOS

### react-table version

v8.9.1

### TypeScript version

v4.9.5.

### Additional context

_No response_

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.