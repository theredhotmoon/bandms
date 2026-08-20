---
number: 99
title: Add Option to disable caching
type: other
state: closed
created: 2020-01-08
url: "https://github.com/TanStack/query/issues/99"
reactions: 30
comments: 6
---

# Add Option to disable caching

One issue I've had is that when writing tests, it's easy to run into problems caused by react-query's caching. It would be good to have an option to disable caching wholesale.

---

## Top Comments

**@nikoskleidis** (+128):

As stated in the docs you can play with cacheTime option
> If and when a query is no longer being used, it becomes inactive and by default is cached in the background for 5 minutes. This time can be configured using the cacheTime option at both the global and query-level.

By setting **cacheTime** to 0 in the options, you can disable caching in a specific query but by setting this to the react-query's provider, you can disable caching for every query 

**@ruangustavo** (+63):

In case anyone is using Tanstack Query in version 5, the `cacheTime` property has been renamed to `gcTime` :)

https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5#rename-cachetime-to-gctime

**@TkDodo** [maintainer] (+20):

> I have observed leaking cache from react-query between tests. 

The solution is to provide each test with its own `QueryClientProvider` and a `new QueryClient()` for each test. That way, you avoid sharing state between tests altogether!
See also: https://tkdodo.eu/blog/testing-react-query#queryclientprovider