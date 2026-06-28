---
number: 9999
title: How to combine two TanStack Query results into a single object?
category: Q&A
created: 2025-11-26
url: "https://github.com/TanStack/query/discussions/9999"
upvotes: 1
comments: 2
answered: false
---

# How to combine two TanStack Query results into a single object?

I have two separate queries using `@tanstack/angular-query`:

```ts
roles = injectQuery(() => ({
  enabled: this.user.data(),
  queryKey: ['roles'],
  queryFn: () =>
    lastValueFrom(getRoles({ roles: this.user.data().roles })),
}));

user = injectQuery(() => ({
  queryKey: ['user'],
  queryFn: () => lastValueFrom(getUser()),
}));
```

I want to keep these queries **separate**, but in the UI I want to consume them as **one combined object**, e.g.:

```html
<div *ngIf="user.data() as user">
  roles: {{ user.roles.length }}
</div>
```

Ideally something like:

```ts
userActive = injectQueries(() => ({
  queries: [this.user, this.roles],
  select: (user, roles) => this.toUser(user, roles),
}));

toUser(user, roles) {
  return { ...user, roles: roles };
}
```

...

---

## Top Comments

**@TkDodo** [maintainer]:

not sure if `injectQueries` supports `combine` but the query-core does, so the idea is:

```
userActive = injectQueries(() => ({
  queries: [this.user, this.roles],
  combine: ([user, roles]) => this.toUser(user, roles),
}));
```

looking at the type signature of `injectQueries`, it does support `combine` too:

https://github.com/TanStack/query/blob/3bf9268770785d153bd9c22c553c110070b99c57/packages/angular-query-experimental/src/inject-queries.ts#L204-L214

**@JohannesIBK**:

ngneat/query has a very useful helper function https://github.com/ngneat/query?tab=readme-ov-file#intersectresults-1. Their version is a lot more useful than the `combine`, because it returns a QueryResult. It would be nice if we get a similar version. Also the current version of `injectQueries` seems to be broken.