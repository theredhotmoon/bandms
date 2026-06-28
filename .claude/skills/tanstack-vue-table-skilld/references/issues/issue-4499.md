---
number: 4499
title: "[v8] getValue should return a null value for nested keys"
type: other
state: open
created: 2022-11-01
url: "https://github.com/TanStack/table/issues/4499"
reactions: 13
comments: 7
---

# [v8] getValue should return a null value for nested keys

### Describe the bug

The issue is related to this issue: https://github.com/TanStack/table/issues/4320#issuecomment-1298293299
The prior issue was solved by introducing an elaborate error message for undefined nested keys.

In a case, where some rows might have nested keys and others not, it is possible to catch the error of getValue, it is not nice though. Furthermore, this also adds up to other functions like getRowModel, when filters are used. So each function would need to get a try catch.
```
try { cell.getValue() } catch { console.error("🙈") }
```

The alternative approach would be, to create an entry for each nested key in each row. But it can be annoying for nested objects.
```
data.forEach((entry)=>{
  if(!(nestedKey0 in entry)){
     entry[nestedKey0] = {}
   }
   if(!(nestedKey1 in entry)){
      entry[nestedKey0][nestedKey1] = null;
   }
})
```



I would propose returning a null value, if the nested key is missing.

https://github.com/TanStack/table/blob/7b9295332306abcc18f23f96be20fe020862c7dd/packages/table-core/src/core/column.ts#L58
```
for (const key of accessorKey.split('.')) {
   if(!(key in result)){
     return null
    }
    result = result[key]
    if (process.env.NODE_ENV !== 'production' && result === undefined) {
       throw new Error(
       `"${key}" in deeply nested key "${accessorKey}" returned undefined.`
        )
     }
}
```

### Your minimal, reproducible example

https://codesandbox.io/s/dark-sky-pwysi7?file=/src/main.tsx

### Steps to reproduce

See codesandbox.
Toggle line 29 comment in main.tsx and see how it works/fails.

I am not using columnHelper, since my use case has a nested Record<string, any> object without proper typing.


### Expected behavior

If getValue() returns null for nested keys, it won´t fail.

### How often does this bug happen?

_No response_

### Screenshots or Videos

_No response_

### Platform

- all

### react-table version

v....