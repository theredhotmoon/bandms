---
number: 5065
title: Accessor Function in columnHelper.group() fails to infer properly
type: other
state: open
created: 2023-09-13
url: "https://github.com/TanStack/table/issues/5065"
reactions: 15
comments: 0
---

# Accessor Function in columnHelper.group() fails to infer properly

### Describe the bug

If you use `createColumnHelper<RowType>()` to make a column helper, then make a group, then make accessor columns inside of that group; then the types of the `TValue` generic for each column ends up as `any` unless you explicitly type it. See the sandbox.

### Your minimal, reproducible example

https://www.typescriptlang.org/play?noUncheckedIndexedAccess=true&allowUnreachableCode=true&allowUnusedLabels=true&noUnusedLocals=true&noUnusedParameters=true&exactOptionalPropertyTypes=true&noFallthroughCasesInSwitch=true&noImplicitOverride=true&noPropertyAccessFromIndexSignature=true&useUnknownInCatchVariables=true&suppressImplicitAnyIndexErrors=true&allowSyntheticDefaultImports=true#code/JYWwDg9gTgLgBAbzgYygUwIYzQYQgGwFcQA7ACTXzDSjgF84AzKCEOAcgAEYMSBnHsgDWAenQZkMALQ8ARvjTsA3AChQkWIgCSfAIIkAng2as4AIhgHqUxmgFnVKy9TgA1DPmAATLMAgkAFQx5NAAlCAB3OABeRBU4OAEoYBIAcwBpNAMALkSYZLSVOkdkfwEUAmJySmpaWNRMbDwiUgoqGgAed08fGD9A4IVwiIA+AAoAShLK1pqaADpUlkIwMYRvXLMliBWAETRkfAx0Ly0STxI0MwAaCpb+XIBtUvu22vmJZDs+aDGWKOiIzg-3mSRSGSytwQ8QScA25gwfC8jBuMISX3w+DWqTQMG6hDQdAmcVhpIq-HgADcPASYnAcXiaWhJmiySIRHAYAALYB8OF8kgQekQCBeVmk0oUuAAD1yOn0Bg6zjQEEYcGpRDQQNijA8fDQ4thkp+Cnm+AgqTW0qJhoS6BghCgJHVTNUpLoRQmAF0bSpjfAXlU+PtDsc0F4APKEGB8bxoADiyzAdOeM2q7SgH2QXz4Pygf0iMSBILBaUyBihrPhZkRyNREsoWIQDPxhOJ0LJRrKVKZdJbTJZnYS7M5PL5vKYKTQcDQlLjJBg+AMtvJ5VlcHlhiVVhVao1BO1TD1BqHq4IaDNFqtNtP9sdzv3aDdsI9RK9frK58vlsDpGDByOE4oxjONEx2MAJiAA

### Steps to reproduce

As described

### Expected behavior

Inference still works as it does when you don't declare columns in a `group`

### How often does this bug happen?

Every time

### Screenshots or Videos

_No response_

### Platform

irrelevant, but macOS

### react-table version

8.9.8

### TypeScript version

5.2.2

### Additional context

You can work around it by making the columns in an array, then assigning the array to the group instead. see the playground link.

### Terms & Code of Conduct

...