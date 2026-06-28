---
number: 5115
title: Size property not working
type: other
state: closed
created: 2023-10-05
url: "https://github.com/TanStack/table/issues/5115"
reactions: 25
comments: 27
---

# Size property not working

### Describe the bug

I am using v8 and unable to change the width of the column of the most simple example according to the document.

https://tanstack.com/table/v8/docs/examples/react/basic

For this example, I opened the sandbox and changed the size of the first column to 500, as below:

```
columnHelper.accessor('firstName', {
  cell: info => info.getValue(),
  footer: info => info.column.id,
  size: 500,
  minSize: 500
}),
```
However the width of the first column remain unchanged

### Your minimal, reproducible example

https://codesandbox.io/p/sandbox/strange-pine-wtqhtg?embed=1&file=%2Fsrc%2Fmain.tsx%3A62%2C15

### Steps to reproduce

Add size property to the first column of basic example one

### Expected behavior

Size property should be respected

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

Chrome

### react-table version

8.10.3

### TypeScript version

_No response_

### Additional context

_No response_

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.

---

## Top Comments

**@sergor5** (+75):

@anduscheung , @aoloo 

You're probably missing the part where you set the width by yourself in the styles prop:
```jsx
<td
  style={{
    width: cell.column.getSize(),
  }}
>
    ...
</td>
```
It's shown here: Tanstack Column Sizing

**@anduscheung** (+24):

Thanks, I thought it is an automatic property 

**@KevinVandy** [maintainer]:

> Someone know a workaround? still doesn't works

Why do you need "a workaround"? You probably have just not hooked up the column size APIs to your CSS properly. Follow the official examples and you should be fine.