---
number: 5397
title: there is a bug when you try sticky pin column group
type: other
state: open
created: 2024-03-07
url: "https://github.com/TanStack/table/issues/5397"
reactions: 17
comments: 9
---

# there is a bug when you try sticky pin column group

### TanStack Table version

8.13.2

### Framework/Library version

18.2.0

### Describe the bug and the steps to reproduce it

open https://tanstack.com/table/v8/docs/framework/react/examples/column-pinning-sticky example and group firstname and lastname

```
const columnHelper = createColumnHelper<Person>();

const defaultColumns: ColumnDef<Person>[] = [
  columnHelper.group({
    id: 'info',
    header: () => <span>Info</span>,
    columns: [
      {
        accessorKey: 'firstName',
        id: 'firstName',
        header: 'First Name',
        cell: (info) => info.getValue(),
        footer: (props) => props.column.id,
        size: 180,
      },
      {
        accessorFn: (row) => row.lastName,
        id: 'lastName',
        cell: (info) => info.getValue(),
        header: () => <span>Last Name</span>,
        footer: (props) => props.column.id,
        size: 180,
      },
    ],
  }),
  {
    accessorKey: 'age',
    id: 'age',
    header: 'Age',
    footer: (props) => props.column.id,
    size: 180,
  },
  {
    accessorKey: 'visits',
    id: 'visits',
    header: 'Visits',
    footer: (props) => props.column.id,
    size: 180,
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: 'Status',
    footer: (props) => props.column.id,
    size: 180,
  },
  {
    accessorKey: 'progress',
    id: 'progress',
    header: 'Profile Progress',
    footer: (props) => props.column.id,
    size: 180,
  },
];
```

then try pin "info" group info to the left (or right).





### Your Minimal, Reproducible Example - (Sandbox Highly Recommended)

https://stackblitz.com/edit/tanstack-table-n7umup?file=src%2Fmain.tsx

### Screenshots or Videos (Optional)




### Do you intend to try to help solve this bug with your own PR?

None

### Terms & Code of Conduct

...

---

## Top Comments

**@dogfootruler-kr** (+7):

I have a workaround where I check if the column have children columns, if so I use the getStart('left') value of the first one otherwise I just get the value normally. 

Like this:
```
export const getCommonPinningStyles = <TData>(column: Column<TData>): CSSProperties => {
  const isPinned = column.getIsPinned();
  const leftValue =
    column.columns.length > 0 ? `${column.columns[0]?.getStart("left")}px` : `${column.getStart("left")}px`;

  return {
    left: isPinned === "left" ? leftValue : undefined,
  };
};
```

**@jack-szeto** (+3):

I don't understand how come using the `getStart()` function would work in a `<table>`. All `<th>`, `<td>` will auto expand their width depend on the widest cell in the same column. I had looked into the source code, both `getStart` function in the column and header are calculating the size from the `ColumnRef` instead of the DOM element. So, how could it be working?

...

**@WoodenPC** (+7):

up