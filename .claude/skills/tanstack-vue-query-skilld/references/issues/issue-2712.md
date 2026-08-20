---
number: 2712
title: Errored queries caught by ErrorBoundary are not retried on mount
type: bug
state: open
created: 2021-09-23
url: "https://github.com/TanStack/query/issues/2712"
reactions: 5
comments: 42
labels: "[bug, help wanted, package: react-query]"
---

# Errored queries caught by ErrorBoundary are not retried on mount

**Describe the bug**
I'm using Suspense and ErrorBoundaries and I'm seeing unexpected behavior when queries are erroring. If a query errors I'm displaying an ErrorBoundary for that part of the UI. Now if I navigate to another page using react-router-dom and navigate back to the page, the ErrorBoundary is still there and the query is not retried. I know that normally you would have to reset the error boundary while you are on the same page to trigger a re-run of the failed queries, but in this case I would've assumed that the queries are retried when I visit the page again, i.e. the components are mounted again. 

**To Reproduce**
1. Visit the Code Sandbox
2. Open the console
3. Wait until the error occurs and the fallback of the ErrorBoundary is shown: "An error occured!" (You need to click off of react-error-overlay to see it)
4. Press the "Hide" button to unmount the ErrorBoundary
5. Press the "Show" button to render it again
6. Query is not re-executed and the error is immediately shown again

**Expected behavior**
The query is re-executed after the component mounts, i.e. honoring the `retryOnMount` setting.

**Desktop (please complete the following information):**
 - Version: 3.24.4