---
number: 4280
title: "[v8] Global filter gives `TypeError: l.toLowerCase is not a function` when using number fields"
type: other
state: closed
created: 2022-08-05
url: "https://github.com/TanStack/table/issues/4280"
reactions: 29
comments: 19
---

# [v8] Global filter gives `TypeError: l.toLowerCase is not a function` when using number fields

### Describe the bug

With latest `8.5.11` version using the Global filter in combination with `number` fields gives:

<img width="951" alt="image" src="https://user-images.githubusercontent.com/197004/183156633-0d53ba16-6e63-4a00-b9da-8f4d0534738f.png">


Note this was already raised in https://github.com/TanStack/table/issues/4210 but still happens with latest version unfortunately.

I think this was introduced somewhere in `8.3.x` line as I first encountered this while upgrading from `8.2.x` to `8.3.3`.

A workaround like

```
      {
        id: 'matches',
        header: 'Matches',
        accessorFn: (originalRow) => originalRow.matches.toString(), // matches is a number
        // accessorKey: 'matches', // this worked before
      },
```

seems to work for the filtering, but this would also impact the sorting I would assume. Sorting on a string value instead of the number value will have impact (1, 2, 10 vs 1, 10, 2).

### Your minimal, reproducible example

.

### Steps to reproduce

See above.

### Expected behavior

Global filter to work with number fields out of the box.

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

macOS, chrome

### react-table version

v8.5.11

### TypeScript version

4.7.4

### Additional context

If reproducible example is needed let me know.

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.

---

## Top Comments

**@decayedCell** (+24):

As a temporary fix I added 
```
enableGlobalFilter: false,
```
To my number column

**@oldo** (+11):

I took a page from @LautaroRiveiro suggestion by overriding the `globalFilterFn`, but instead of casting all values as a `String` I do a check on whether the field is a number, and if so only then make a conversion to a string:

```
const globalFilterFn: FilterFn<T> = (row, columnId, filterValue: string) => {
  const search = filterValue.toLowerCase();

  let value = row.getValue(columnId) as string;
  if (typeof value === 'number') value = String(value);

  return value?.toLowerCase().includes(search);
};
```

**@LautaroRiveiro** (+5):

I am so novice on this. I copied the includesString built-in function and converted the value to string. And now use that as the globalFilterFn.
Do you think it could be useful?



```import { FilterFn } from '@tanstack/react-table'

function testFalsey (val: any): boolean {
  return val === undefined || val === null || val === ''
}

export const includesString: FilterFn<any> = (
  row,
  columnId: string,
  filterValue: string
) => {
  const search = filterValue.toLowerCase()
  // Convert to String
  const value = String(row.getValue<string>(columnId))
  return value?.toLowerCase().includes(search)
}

includesString.autoRemove = (val: any) => testFalsey(val)```...