---
number: 10009
title: PersistedQueryClientProvider causing UI freeze in react native
category: Q&A
created: 2025-12-31
url: "https://github.com/TanStack/query/discussions/10009"
upvotes: 3
comments: 3
answered: false
---

# PersistedQueryClientProvider causing UI freeze in react native

Hi, I have been trying to implement query persistence in my react native app made with expo.

The issue I am facing is that the UI freezes for 2 to 3 seconds when user opens the app and it blocks the navigation as well.

This is my HOC for the persistence provider:

...

---

## Top Comments

**@krishparmar22242** (+1):

This is a common performance bottleneck in React Native when using AsyncStorage with TanStack Query. The 2-3 second UI freeze happens because AsyncStorage is relatively slow, and once the data is retrieved, the JavaScript thread has to synchronously parse a potentially large JSON string of your cache, which blocks the UI.

Here are the most effective ways to solve this, ranked from the "Proper Fix" to optimization steps.

1. The "Proper" Fix: Switch to MMKV
AsyncStorage uses the old "bridge" in React Native, which is slow for large data sets. The industry standard for performance is react...

**@TkDodo** [maintainer]:

hard to say without a runnable reproduction

**@ismaildasci**:

the UI freeze happens because AsyncStorage is slow and blocks the main thread during hydration.

few things to try:

1. use MMKV instead of AsyncStorage (much faster):
```bash
pnpm add react-native-mmkv
```
```ts
import { MMKV } from "react-native-mmkv"

const storage = new MMKV()

const mmkvPersister = {
  setItem: (key, value) => storage.set(key, value),
  getItem: key => storage.getString(key) ?? null,
  removeItem: key => storage.delete(key),
}
```

...