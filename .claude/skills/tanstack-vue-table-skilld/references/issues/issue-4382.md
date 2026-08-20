---
number: 4382
title: ColumnDef types gives typescript error
type: other
state: open
created: 2022-09-15
url: "https://github.com/TanStack/table/issues/4382"
reactions: 77
comments: 61
---

# ColumnDef types gives typescript error

### Describe the bug

Looking at the examples and docs I expect this to correctly type my columns for me. Instead I get a large error with this code:

```
  type Example = {
    name: string
    age: number
  }

  const columnHelper = createColumnHelper<Example>()

  const columns = useMemo<ColumnDef<Example>[]>(
    () => [
      columnHelper.accessor("name", {
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("age", {
        cell: (info) => info.getValue(),
      }),
    ],
    [columnHelper],
  )
```
<img width="925" alt="bild" src="https://user-images.githubusercontent.com/19165426/190345429-3d72a391-05e3-48e8-8c19-4b2240fdc61a.png">

Am I doing something wrong here?

Regards Jonathan


### Your minimal, reproducible example

https://codesandbox.io/s/typescript-playground-export-forked-iqm265?file=/index.tsx

### Steps to reproduce

1. Create a type with two different types, string and name for example.
2. Use the createColumnHelper with the type
3. Define columns with columnHelper and type them with ColumnDef<type>

### Expected behavior

I expected the Columdef to correctly type my columns. 

### How often does this bug happen?

Every time

### Screenshots or Videos

<img width="925" alt="bild" src="https://user-images.githubusercontent.com/19165426/190345707-0d075867-7248-440f-bcce-59162452a904.png">


### Platform

Mac OS

### react-table version

v8.5.13

### TypeScript version

v4.8.2

### Additional context

_No response_

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.

---

## Top Comments

**@tannerlinsley** [maintainer] (+13):

You should only be using the column helper and not pre-typing anything. 

**@Jontii** (+19):

We skipped using columnDef, it still works as good and gives type help. 

```
  const columns = [
      columnHelper.accessor("name", {
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("age", {
        cell: (info) => info.getValue(),
      }),
    ]
```

**@tannerlinsley** [maintainer] (+10):

This is the way. 