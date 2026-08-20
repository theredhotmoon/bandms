---
name: frontend-security-audit-grep
description: Grep commands for auditing frontend security — XSS vectors, token leaks, URL injection, secrets, WebSocket TLS.
---

# Frontend Security — Audit Grep Cheatsheet

Run from the repo root.

```bash
# XSS
grep -rn "v-html" frontend/src/
grep -rn ":href\|:src" frontend/src/ | grep -v "@/"
grep -rn "v-bind=\"" frontend/src/
grep -rn "eval\|new Function\|innerHTML\|outerHTML\|document\.write" frontend/src/

# Auth / token
grep -rn "queryKey.*token\|token.*queryKey" frontend/src/
grep -rn "queryClient\.clear" frontend/src/    # must appear in logout
grep -rn "localStorage\b" frontend/src/ | grep -v useLocalStorage

# URL injection
grep -rn "route\.params" frontend/src/ | grep -v "router/"

# Secret exposure
grep -rn "VITE_" frontend/src/ frontend/.env.example

# Console leaks
grep -rn "console\." frontend/src/ | grep -i "token\|password\|user\|auth"

# WebSocket TLS
grep -rn "forceTLS\|VITE_REVERB_SCHEME" frontend/src/ frontend/.env.example

# assertSafeId coverage
grep -rn "\`\${" frontend/src/api/ | grep -v assertSafeId
```
