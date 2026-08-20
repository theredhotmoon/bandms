# Vue Component Generator

Generate a well-structured Vue 3 TypeScript component following project conventions.

## Instructions

When the user provides a component name and description, create a production-quality Vue 3 component using:

**Structure rules:**
- `<script setup lang="ts">` — always use `<script setup>` syntax, never Options API
- Order: imports → types/interfaces → props/emits → composables/refs → computed → methods → lifecycle hooks
- `<template>` after script, `<style scoped>` last
- One component per file, filename in PascalCase

**Props & Emits:**
- Define props with `defineProps<{...}>()` using explicit TypeScript interface (never `withDefaults` unless defaults are needed)
- Define emits with `defineEmits<{...}>()` using the object syntax (not array)
- For optional props with defaults: `withDefaults(defineProps<Props>(), { ... })`

**Typing:**
- No `any` — use `unknown` and narrow it, or define proper types
- Prefer `interface` over `type` for object shapes
- Import Vue types explicitly: `Ref`, `ComputedRef`, `MaybeRef`, etc.

**Composables:**
- Extract logic >10 lines into `composables/use<Name>.ts`
- Composables return plain object (not reactive wrapper) — let caller decide reactivity
- Always prefix with `use`

**Template:**
- Use `v-bind` shorthand (`:`) and `v-on` shorthand (`@`)
- Avoid logic in templates — compute it in script
- Use `<component :is>` for dynamic components
- Key every `v-for` with a stable, non-index key when possible

**Styles:**
- Always `scoped` unless intentionally global
- Use CSS custom properties for theming, not hardcoded colors
- BEM naming for class names inside the component

Generate the component now based on the user's description: $ARGUMENTS
