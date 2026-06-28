---
number: 9735
title: "Angular query: Optimistic updates are not synchronous"
type: other
state: open
created: 2025-10-06
url: "https://github.com/TanStack/query/issues/9735"
reactions: 2
comments: 6
labels: "[package: angular-query]"
---

# Angular query: Optimistic updates are not synchronous

### Describe the bug

Here's a stackblitz that repro's the issue about 20% of the time (I think it's timing related): https://stackblitz.com/edit/stackblitz-starters-hn17w1mv?file=src%2Fmain.ts,src%2Findex.html

If you click "edit" and change the "whatever" to just "1", then tab out to trigger blur, you'll see the "whatever" show up for 1 frame. I think this is happening because the optimistic update (which should set the title to "1") is not happening until the next frame. So when I set the "isEditingTitle" signal to false, it flickers the old title for 1 frame. I would expect the optimistic update to be immediate and synchronous, like how normal signals behave, so this flicker never happens.

...