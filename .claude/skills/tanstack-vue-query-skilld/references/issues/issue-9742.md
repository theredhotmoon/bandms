---
number: 9742
title: Is React Query incompatible with React Actions/Transitions/`useOptimistic`?
type: other
state: open
created: 2025-10-09
url: "https://github.com/TanStack/query/issues/9742"
reactions: 8
comments: 1
labels: "[upstream]"
---

# Is React Query incompatible with React Actions/Transitions/`useOptimistic`?

In this reduced test case I'm seeing some odd behaviour when combining React Query with React Actions/Transitions and `useOptimistic`.

- We have a query that returns a count, starting at 1.
- When a user clicks this button, we run an action to add 1 to the count. The action does the following:
  1. optimistically adds 1 to the count
  2. server mutation to update the server-side count
  3. refetch query for count

If we click the button once, I expect the count to show 2.

However, the actual behaviour is this:

1. Count shows 2 (optimistic update).
2. Then count briefly shows 3 when the query refetch finishes.
3. Then count reverts to 2.

https://github.com/user-attachments/assets/6a60e351-fb76-4162-8b60-48adcca9f518

### My investigation

Looking at the logs, I believe this is what is happening:

1. Server state begins at 1 
1. User clicks button. Optimistic count is now server state + 1 = 2. 
1. Refetch finishes. _React Query synchronously updates_. The new server state is 2. React rebases the optimistic state on top of the new server state: server state + 1 = 3. 
1. Finally, action finishes so React drops optimistic state and count reverts back to 2. 

<img width="339" height="510" alt="Image" src="https://github.com/user-attachments/assets/224c43db-0f74-41f7-96c8-c1efbe7cb083" />

...

---

## Top Comments

**@TkDodo** [maintainer] (+5):

I think we need concurrent stores for this