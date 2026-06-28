---
number: 6186
title: hashQueryKey is not exported from tanstack/react-query
type: docs
state: closed
created: 2023-10-19
url: "https://github.com/TanStack/query/issues/6186"
reactions: 13
comments: 14
labels: "[documentation]"
---

# hashQueryKey is not exported from tanstack/react-query

### Describe the bug

I was following a video to use nextj.js 13 app router, trcp, react-query and all was good until i try to call my query from the client and sudenly all crash. I try to find a solution on google but isn't reported yet. Then I check and find that react-query have released just days before this post to 5.0.0. I did a downgrade to 4.36.1 and now all work properly.

PD: I will add more info later

Ref to video follow all steps until min 7:30

trace of the error 
```
./node_modules/.pnpm/@trpc+react-query@10.40.0_@tanstack+react-query@5.0.0_@trpc+client@10.40.0_@trpc+server@10.40_j5b6dh2qmadaikfcthvzn2bani/node_modules/@trpc/react-query/dist/createHooksInternal-f1d4019d.mjs
Attempted import error: 'hashQueryKey' is not exported from '@tanstack/react-query' (imported as 'hashQueryKey').

Import trace for requested module:
./node_modules/.pnpm/@trpc+react-query@10.40.0_@tanstack+react-query@5.0.0_@trpc+client@10.40.0_@trpc+server@10.40_j5b6dh2qmadaikfcthvzn2bani/node_modules/@trpc/react-query/dist/createHooksInternal-f1d4019d.mjs
./node_modules/.pnpm/@trpc+react-query@10.40.0_@tanstack+react-query@5.0.0_@trpc+client@10.40.0_@trpc+server@10.40_j5b6dh2qmadaikfcthvzn2bani/node_modules/@trpc/react-query/dist/index.mjs
./src/app/_trpc/client.ts
./src/app/_trpc/Provider.tsx
```

package.json

```
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "@trpc/client": "^10.40.0",
    "@trpc/react-query": "^10.40.0",
    "@trpc/server": "^10.40.0",
    "next": "13.5.6",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10",
    "eslint": "^8",
    "eslint-config-next": "13.5.6",
    "postcss": "^8",
    "tailwindcss": "^3",
    "typescript": "^5"
  }
}
```




### Your minimal, reproducible example

check the code here 
https://gith...

---

## Top Comments

**@TkDodo** [maintainer] (+45):

I forgot to list this change in the migration guide, sorry for that. `hashQueryKey` was merely renamed to `hashKey` because it also hashes mutation keys.

docs are updated already: https://tanstack.com/query/v5/docs/react/guides/migrating-to-v5#hashquerykey-has-been-renamed-to-hashkey

but note that you cannot use trpc v10 with react-query v5, they are structurally incompatible. the trpc team is working on v11, which will be RQ v5 compatible. You can already try it out with the `@trpc/react-query@next` tag.

**@rekdt** (+26):

Open your package.json file, locate the line with @tanstack/react-query, and change the version number to ^4.35.3:

"@tanstack/react-query": "^4.35.3",

Then run: pnpm install

**@raymclee** (+9):

I got the same issue