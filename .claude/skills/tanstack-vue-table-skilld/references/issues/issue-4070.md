---
number: 4070
title: "[v8.0.8]Could not find a declaration file for module '@tanstack/react-table'"
type: other
state: closed
created: 2022-06-29
url: "https://github.com/TanStack/table/issues/4070"
reactions: 13
comments: 3
---

# [v8.0.8]Could not find a declaration file for module '@tanstack/react-table'

### Describe the bug

Error message `Could not find a declaration file for module '@tanstack/react-table'` when importing it.

### Your minimal, reproducible example

-

### Steps to reproduce

I intended to migrate from v7 to v8, however, I got this error message `Could not find a declaration file for module '@tanstack/react-table'` when importing it.

### Expected behavior

As a user, I expect it to work better than react-table v7.

### How often does this bug happen?

_No response_

### Screenshots or Videos

> TS7016: Could not find a declaration file for module '@tanstack/react-table'. './node_modules/@tanstack/react-table/build/cjs/react-table/src/index.js' implicitly has an 'any' type.   Try `npm i --save-dev @types/tanstack__react-table` if it exists or add a new declaration (.d.ts) file containing `declare module '@tanstack/react-table';

### Platform

- WebStorm
- macOs 
- Chrome

### react-table version

v8.0.8

### TypeScript version

v4.7.3

### Additional context

_No response_

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [x] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.