---
number: 4423
title: TypeScript thinks that accessorKey is not an accessible property when column is defined with createColumnHelper
type: other
state: closed
created: 2022-10-05
url: "https://github.com/TanStack/table/issues/4423"
reactions: 21
comments: 28
---

# TypeScript thinks that accessorKey is not an accessible property when column is defined with createColumnHelper

### Describe the bug

When I describe columnDefs via the `createColumnHelper` api, TypeScript informs me that `accessorKey` is unavailable. But when I console log the contents of the defined columns, `accessorKey` is very clearly available.

### Your minimal, reproducible example

https://codesandbox.io/s/tanstack-react-table-accessorkey-issue-v68163

### Steps to reproduce

1. Run the codesandbox
2. Examine the typescript issue on line 22
3. Examine the rendered content and the console log

### Expected behavior

As a user, I expect to be able to access `accessorKey` without typescript issues when defining my columns via the `createColumnHelper` API, but typescript doesn't think the field exists or is available

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

```
  System:
    OS: macOS 12.5.1
    CPU: (16) x64 Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz
    Memory: 182.22 MB / 16.00 GB
    Shell: 5.8.1 - /bin/zsh
  Binaries:
    Node: 16.17.1 - ~/.nvm/versions/node/v16.17.1/bin/node
    Yarn: 1.22.19 - ~/.nvm/versions/node/v16.17.1/bin/yarn
    npm: 8.15.0 - ~/.nvm/versions/node/v16.17.1/bin/npm
  Browsers:
    Chrome: 105.0.5195.125
    Safari: 15.6.1
  npmPackages:
    @tanstack/react-table: 8.5.15 => 8.5.15 
    react: 18.0.0 => 18.0.0 
    typescript: ^4.6.2 => 4.8.3
```

### react-table version

8.5.15

### TypeScript version

4.8.3

### Additional context

_No response_

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.

---

## Top Comments

**@jonahallibone** (+8):

+1 Same issue here
```ts
const [columnVisibility, setColumnVisibility] = useState(
  columns.map((column) => ({ [column.accessorKey]: true }))
);
```

```
Property 'accessorKey' does not exist on type 'ColumnDef<DataType, DataType[string]> | ColumnDef<DataType, DataType[number]> | ColumnDef<DataType, DataType[symbol]>'.
  Property 'accessorKey' does not exist on type '{ footer?: ColumnDefTemplate<HeaderContext<DataType, DataType[string]>> | undefined; cell?: ColumnDefTemplate<CellContext<DataType, DataType[string]>> | undefined; meta?: ColumnMeta<...> | undefined; } & ... 6 more ... & StringHeaderIdentifier'.ts(2339)
```...

**@KevinVandy** [maintainer] (+1):

The intent with this is that you are supposed to access the `id` property instead of accessorKey in a ColumnDef. The accessorKey value gets copied over to `id` internally. I guess we could add accessorKey as a optional type, but it's not guaranteed to be present if an accessorFn is used instead.

**@Tushara710406** (+6):

any updates on this issue