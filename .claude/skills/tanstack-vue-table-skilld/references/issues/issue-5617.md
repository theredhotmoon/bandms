---
number: 5617
title: Unexpected behavior of array filterFns (arrIncludes, arrIncludesAll, arrIncludesSome)
type: other
state: open
created: 2024-06-20
url: "https://github.com/TanStack/table/issues/5617"
reactions: 18
comments: 4
---

# Unexpected behavior of array filterFns (arrIncludes, arrIncludesAll, arrIncludesSome)

### TanStack Table version

v8.16.0

### Framework/Library version

react@18.3.1

### Describe the bug and the steps to reproduce it

When implementing filters on a table, I encountered an issue where the column value is a string, but the filter value is an array. 

I have included a example case that shows the unexpected behavior. 
I based it on the filter example from the docs, but modified it to include a new relationship state with the value `complicated relationship`. I also changed the `setFilterValue` call to set the value as an array (to simulate what would happen when selecting multiple possible values).

In my example selecting either "relationship" or "complicated" from the select filter will match with the value "complicated relationship". 

This is due to how the array filters are implemented, assuming that both the column and the filter value are both arrays. But since the column value in this case is of type `string` it instead uses the `includes` method from the string prototype, which is what I think is unexpected behavior.

This is how it is currently implemented:
```ts
const arrIncludesSome: FilterFn<any> = (
  row,
  columnId: string,
  filterValue: unknown[]
) => {
  return filterValue.some(
    val => row.getValue<unknown[]>(columnId)?.includes(val)
  )
}
```
And this is how I expected it to work:
```ts
const arrIncludesSome: FilterFn<any> = (
  row,
  columnId: string,
  filterValue: unknown[]
) => {
  if (Array.isArray(row.getValue<unknown>)) {
	  return filterValue.some(
	    val => row.getValue<unknown[]>(columnId)?.includes(val)
	  )
  }
  return filterValue.some(val => val === row.getValue<unknown>(columnId));
}
```



### Your Minimal, Reproducible Example - (Sandbox Highly Recommended)

http...

---

## Top Comments

**@djshubs**:

+1

It would be awesome to have this fixed natively. 

**@nleborgne**:

+1, nice implementation