# Vue 3 TypeScript Type & Interface Generator

Generate well-structured TypeScript types and interfaces for a Vue 3 project domain.

## Instructions

Create TypeScript types/interfaces for the described domain:

**General rules:**
- Use `interface` for object shapes that may be extended; `type` for unions, intersections, utility types
- No `any` — use `unknown` for truly unknown shapes, then narrow
- Export everything from a barrel `types/index.ts` unless the type is component-private
- Prefix API response shapes with the entity name: `User`, `UserResponse`, `UserPayload`

**Vue-specific patterns:**
- Component prop interfaces: `interface <ComponentName>Props { ... }` co-located in the component file
- Emit event payloads: inline in `defineEmits` or as named type `<ComponentName>Emits`
- Composable return types: explicit named interface `Use<Name>Return`
- Store state: `interface <Name>State { ... }` in the store file

**Discriminated unions for state:**
```ts
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }
```
Use this pattern (or a variant) for any async data — never mix `data | null` with a boolean `isLoading`.

**API contracts:**
- Separate request payload types from response types
- Use `Partial<T>` for patch/update payloads rather than duplicating fields
- Use `Pick<T, keys>` and `Omit<T, keys>` to derive related types rather than rewriting them

**Enums vs union literals:**
- Prefer `'value1' | 'value2'` string unions over `enum` for simple sets
- Use `const` object + `typeof` for when you need both a value and a type:
  ```ts
  const STATUS = { Active: 'active', Inactive: 'inactive' } as const
  type Status = typeof STATUS[keyof typeof STATUS]
  ```

Generate types for: $ARGUMENTS
