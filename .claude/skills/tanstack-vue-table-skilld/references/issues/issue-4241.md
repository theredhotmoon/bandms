---
number: 4241
title: columnHelper.accessor Type issue
type: other
state: closed
created: 2022-07-29
url: "https://github.com/TanStack/table/issues/4241"
reactions: 28
comments: 68
---

# columnHelper.accessor Type issue

### Describe the bug

When defining the columns for the table, `columnHelper.accessor` seems to cause a type issue. Although, table seems to render fine.

Type error:
`Type 'ColumnDef<Room, string>' is not assignable to type 'ColumnDef<Room, unknown>'.`

StackBlitz Type Error:
```
Type instantiation is excessively deep and possibly infinite.(2589)
(property) accessor: <"id", string>(accessor: "id", column: Omit<ColumnDef<Room, string>, "accessorKey">) => ColumnDef<Room, string>
```

### Your minimal, reproducible example

https://stackblitz.com/edit/github-sq9c9a?file=pages%2Findex.tsx

### Steps to reproduce

Line 22 on `index.tsx`

### Expected behavior

No type error

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

Windows 11 Pro
Chrome: Version 103.0.5060.134 (Official Build) (64-bit)

### react-table version

8.5.2

### TypeScript version

4.7.4

### Additional context

_No response_

### Terms & Code of Conduct

- [X] I agree to follow this project's Code of Conduct
- [X] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.

---

## Top Comments

**@tannerlinsley** [maintainer] (+20):

Working on a fix right now

Tanner Linsley
On Jul 29, 2022, 3:55 PM -0600, Dustin Wilson ***@***.***>, wrote:
> We just installed the latest version with a fresh Next.js app and I am seeing the exact same issue with columnHelper types.
> —
> Reply to this email directly, view it on GitHub, or unsubscribe.
> You are receiving this because you are subscribed to this thread.Message ID: ***@***.***>


**@Obiwarn** (+4):

FYI: updated to v8.5.6 labeled:

_Fix
type instantiation is excessively deep (https://github.com/TanStack/table/pull/4262) (https://github.com/TanStack/table/commit/a9c4ded243a105a54059f76754963b5e084125ff) by @Himself65_ 

still shows the error.

**@tannerlinsley** [maintainer]:

We just shipped new types for the columnHelper along with better underlying column def types. Will you try them out and report back?