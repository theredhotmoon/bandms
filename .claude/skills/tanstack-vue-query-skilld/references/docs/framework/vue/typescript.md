---
id: typescript
title: TypeScript
ref: docs/framework/react/typescript.md
replace:
  {
    'React': 'Vue',
    '@tanstack/react-query': '@tanstack/vue-query',
    'react-query package version': 'vue-query package version',
  }
---

[//]: # 'TypeInference1'

```tsx
const { data } = useQuery({
  //    ^? const data: Ref<number> | Ref<undefined>
  queryKey: ['test'],
  queryFn: () => Promise.resolve(5),
})
```

typescript playground

[//]: # 'TypeInference1'
[//]: # 'TypeInference2'

```tsx
const { data } = useQuery({
  //      ^? const data: Ref<string> | Ref<undefined>
  queryKey: ['test'],
  queryFn: () => Promise.resolve(5),
  select: (data) => data.toString(),
})
```

typescript playground

[//]: # 'TypeInference2'
[//]: # 'TypeInference3'

```tsx
const fetchGroups = (): Promise<Group[]> =>
  axios.get('/groups').then((response) => response.data)

const { data } = useQuery({ queryKey: ['groups'], queryFn: fetchGroups })
//      ^? const data: Ref<Group[]> | Ref<undefined>
```

typescript playground

[//]: # 'TypeInference3'
[//]: # 'TypeNarrowing'

```tsx
const { data, isSuccess } = reactive(
  useQuery({
    queryKey: ['test'],
    queryFn: () => Promise.resolve(5),
  }),
)

if (isSuccess) {
  data
  // ^? const data: number
}
```

typescript playground

[//]: # 'TypeNarrowing'
[//]: # 'TypingError'

```tsx
const { error } = useQuery({ queryKey: ['groups'], queryFn: fetchGroups })
//      ^? const error: Ref<unknown>

if (error.value instanceof Error) {
  error.value
  //     ^? const error: Error
}
```

typescript playground

[//]: # 'TypingError'
[//]: # 'TypingError2'
[//]: # 'TypingError2'
[//]: # 'TypingError3'
[//]: # 'TypingError3'
[//]: # 'RegisterErrorType'

```tsx
import '@tanstack/vue-query'

declare module '@tanstack/vue-query' {
  interface Register {
    // Use unknown so call sites must narrow explicitly.
    defaultError: unknown
  }
}

const { error } = useQuery({ queryKey: ['groups'], queryFn: fetchGroups })
//      ^? const error: unknown | null
```

[//]: # 'RegisterErrorType'
[//]: # 'TypingMeta'
[//]: # 'TypingMeta'
[//]: # 'TypingQueryOptions'
[//]: # 'TypingQueryOptions'
[//]: # 'Materials'
[//]: # 'Materials'
