---
number: 10062
title: Data should be readonly
category: Q&A
created: 2026-01-19
url: "https://github.com/TanStack/query/discussions/10062"
upvotes: 1
comments: 1
answered: false
---

# Data should be readonly

### Describe the bug

I'm trying to mock some data because the type for data is Ref, but according to the warning is a redonly one?
https://vuejs.org/api/reactivity-core#readonly
```ts
const {
  data: ladders,
  isLoading,
  refetch
} = useQuery<LadderListResponse[]>({
  queryKey: ['ladders'],
  queryFn: () => competitionsApi.getLadders(),
  initialData: [],
  placeholderData: []
});

onMounted(async () => {
  await refetch();
  ladders.value = [
    {
      id: 1,
      name: 'Ladder 1',
      type: 'classic',
      visibility: 'public'
    }
  ];
});
```
<img width="588" height="109" alt="Image" src="https://github.com/user-attachments/assets/4714bdf3-9db0-47f9-9862-a36d4a870f6c" />

### Your minimal, reproducible example

Explained in description

### Steps to reproduce

...

---

## Top Comments

**@TkDodo** [maintainer]:

I don’t think you’re supposed to directly modify data like that. We have `queryClient.setQueryData` for updates.