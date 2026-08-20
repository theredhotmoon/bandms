---
number: 6046
title: Incorrect TableMeta definition
type: other
state: open
created: 2025-06-25
url: "https://github.com/TanStack/table/issues/6046"
reactions: 6
comments: 0
---

# Incorrect TableMeta definition

### TanStack Table version

v8.21.3

### Framework/Library version

v19.1.0

### Describe the bug and the steps to reproduce it

Looking at the documentation on the meta property, the only way to effectively type this information is, in every file where I need to declare this typing, to extend the interface as in the following example.

```tsx
declare module '@tanstack/table-core' {
  interface TableMeta<TData extends RowData> {
    foo: string
  }
}
```

The problem is that when you don't use "TData" in the TableMeta declaration, TypeScript displays the message `'TData' is declared but its value is never read` and when you remove the typing declaration, TypeScript displays the message `All declarations of 'TableMeta' must have identical type parameters`.

I believe that the solution to this problem would be to adjust the declaration of the TableMeta interface, leaving the TData value as the default RowData like this:

> See: https://github.com/TanStack/table/blob/main/packages/table-core/src/types.ts#L118

```tsx
export interface TableMeta<TData extends RowData = RowData> {
}
```

This will make it possible to make the declaration as stated in the documentation without necessarily passing the TData, ensuring correct typing in the ColumnHelper type like this:

```tsx
import { useNavigate } from 'react-router';

...