---
number: 2774
title: Performance is too slow while selecting row or moving to next page with 300 rows
type: other
state: closed
created: 2020-10-14
url: "https://github.com/TanStack/table/issues/2774"
reactions: 20
comments: 9
---

# Performance is too slow while selecting row or moving to next page with 300 rows

**Describe the bug (required)**
I am rendering 100 rows by default having 52 columns with contains links and free text as cell values. whenever i change page count to 300 rows, it takes around 10-12 seconds to reflect new data everytime. 
Same way it also takes 5-6 seconds while selecting any row with useRowSelect.

**Provide an example via Codesandbox! (required)**
Since there are lots of columns data and rows, can't exactly create replica in sandbox, but i am uploading my profiler.json which i downloaded from React-Profiler tab. Maybe it will help

**Expected behavior (Recommended)**
It should not take 10-12 seconds to render 300 rows.

**Screenshots**



**Desktop (please complete the following information):**
- OS: Ubuntu
- Browser Chrome
- Version 84.0.4147.125

profiling-data.14-10-2020.17-12-35.zip

Here is my Code:

...