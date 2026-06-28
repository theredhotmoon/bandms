---
number: 2304
title: Status of useMutation not shared across usages/components with custom hook (like useQuery does)
type: feature
state: closed
created: 2021-05-21
url: "https://github.com/TanStack/query/issues/2304"
reactions: 92
comments: 20
labels: "[enhancement, v5]"
---

# Status of useMutation not shared across usages/components with custom hook (like useQuery does)

**Describe the bug**

Imagine creating a custom hook (let's name it `useTodos`) which is used in multiple components and uses `useQuery` and `useMutation` inside.
When using `useQuery`, its status (and the helpers `isLoading`, `isError`, ...) are shared across multiple usages of `useTodos`.
For `useMutation`, this is not true. Every usage of `useTodos` will have its own mutation status.


**To Reproduce**

Here's a CodeSandbox that shows the behavior.

It shows two components that both use `useTodos`.
For GET requests (via `useQuery`), the status is shared across the components.
For POST requests (via `useMutation`), the status is different for both components. Only the component who executes the mutation will have the status "error".




**Expected behavior**

I understand that `useQuery` has one precise query key to identify "the same hook". Mutations are not like that.
In my case, I had a list that showed items (like "Todos") and a child component that was supposed to create a new item (like "Todo"). Naturally, I used `useTodos` in both components and wanted to show an error in the List component. The problem is `isError` was never `true`, only the child component's one was.

```tsx
function TodoList() {
  // this "isError" here will never be true, only the <Todo> component's "isError" will
  const { todos, isError } = useTodos();

  return (
    <div>
      <p>Todos:</p>
      {isError && <p>Error!</p>}
      <div>
        {todos.map((todo) => (
          <Todo todo={todo} />
        ))}
      </div>
    </div>
  );
}

function Todo({ todo }: { todo: Todo | null }) {
  const { createTodo } = useTodos();

  return (
    <div>
      {todo ? (
        <p>{todo.title}</p>
      ) : (
        <div>
          <button onClick={() => createTodo(...)}>Create</button>
          <input ... />
           ...
        </div>
      )}
    </div>
  );
}
```...

---

## Top Comments

**@TkDodo** [maintainer] (+18):

Yes, I was also surprised by this, but `mutationKey` is not required, unlike the `queryKey`, so we can't really create a subscription like for `useQuery`. Mutations are also imperative so it just doesn't happen very often I guess. What we do have is the `useIsMutating` hook, similar to the `useIsFetching` hook, so that you know when a mutation is in-flight, and you can filter these by mutationKey. With that, you can e.g. disable all buttons that would trigger the same mutation. Not sure how that would fix the error situation though - but you can take a look how to create a subscription to the ...

**@TkDodo** [maintainer] (+13):

@stefan-toubia it is something that is on my mind for quite some time. What if mutations were conceptually "just" disabled queries, where `mutate` or `mutateAsync` just calls `refetch()`  .

Not only would that get rid of a ton of internal code (MutationCache, Mutation, MutationObserver, ...), it would also, at the same time, add a lot of _features_ for mutations, like sharing data, `select` and other options.

Of course, we could still turn off some of the options and / or set different default values for `useMutation`.

However, when I went down that road, there is one thing that wor...

**@TkDodo** [maintainer] (+8):

> Feel free to move this issue to the discussions, so we keep it there as a "feature request".

let's keep here, I'd like to analyze how hard it would be to actually use the `mutationKey` to achieve that functionality, or if that would be a breaking change.