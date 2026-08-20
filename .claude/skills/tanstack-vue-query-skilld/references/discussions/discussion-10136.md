---
number: 10136
title: TanStack Query in React Native - A Rick & Morty server-side filtering question (interactive example inside)
category: Q&A
created: 2026-02-14
url: "https://github.com/TanStack/query/discussions/10136"
upvotes: 1
comments: 0
answered: false
---

# TanStack Query in React Native - A Rick & Morty server-side filtering question (interactive example inside)

**I prepared an interactive/editable single file expo-snack example that you can run in the browser (or simply download the expo go app on your phone, scan the QR code and you're ready to go)**

I have a Rick and Morty CRUD app with server-side filtering (multiple filters that can be applied at once) and infinite scrolling. We apply filters from a modal and those are **status** and **gender**. In the past I'd do this manually manually which was a **nightmarish mess**. Maintaining all those error, loading states and everything. But I recently discovered `useInfiniteQuery` from **TanStack Query** and it seemed perfect. But while trying to implement it, I also discovered some pitfalls and I'm here asking you how to avoid them ...