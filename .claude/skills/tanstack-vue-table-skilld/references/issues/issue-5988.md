---
number: 5988
title: Slow performance with devtools open
type: other
state: open
created: 2025-04-13
url: "https://github.com/TanStack/table/issues/5988"
reactions: 8
comments: 4
---

# Slow performance with devtools open

### TanStack Table version

v8.21.2

### Framework/Library version

React v19.1.0

### Describe the bug and the steps to reproduce it

Run `npm i react@latest react-dom@latest @types/react@latest @types/react-dom@latest` and restart the app.

In the sorting example, change the number of rows visible to make the effect more visible.
(Change `.rows.slice(0, 10)` to something like 300.

Sorting by say the Age column, I can click through very fast, almost instant.

Open devtools, and click through sorting the age column again. It is noticeably slower for me, about a second.
Only happens in React 19

Removing the `flexRender` makes it fast. Possibly related https://github.com/TanStack/table/issues/4962


### Your Minimal, Reproducible Example - (Sandbox Highly Recommended)

https://tanstack.com/table/v8/docs/framework/react/examples/sorting

### Screenshots or Videos (Optional)

_No response_

### Do you intend to try to help solve this bug with your own PR?

None

### Terms & Code of Conduct

- [x] I agree to follow this project's Code of Conduct
- [x] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.