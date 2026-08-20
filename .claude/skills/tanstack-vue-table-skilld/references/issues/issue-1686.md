---
number: 1686
title: React Table v6 unable to get data since 6.11.2 update
type: other
state: closed
created: 2019-12-03
url: "https://github.com/TanStack/table/issues/1686"
reactions: 48
comments: 38
---

# React Table v6 unable to get data since 6.11.2 update

Uncaught (in promise) TypeError: Cannot read property 'forEach' of undefined.

React table unable to get the data since last update & throwing above error.

Issue since: Version 6.11.2

Not reproducible till Version 6.10.3

---

## Top Comments

**@tannerlinsley** [maintainer] (+21):

The default installation for react-table is now version 7-beta. You'll need to lock into a v6 version from here on out to keep using it as you are.

**@tannerlinsley** [maintainer] (+10):

With that said, 6.11.2 should be working just fine. I'll go and double check the examples to make sure we didn't miss something.

**@pallymore** (+13):

sorry folks, it was me (again). temporary fix here: https://github.com/tannerlinsley/react-table/pull/1699 