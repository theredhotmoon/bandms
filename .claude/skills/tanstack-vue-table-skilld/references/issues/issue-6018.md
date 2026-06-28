---
number: 6018
title: Can react-table v7 be safely used with React 19?
type: other
state: open
created: 2025-05-21
url: "https://github.com/TanStack/table/issues/6018"
reactions: 14
comments: 4
---

# Can react-table v7 be safely used with React 19?

### TanStack Table version

v7

### Framework/Library version

React v19

### Describe the bug and the steps to reproduce it

Hi Team,

I’m currently maintaining a project that uses react-table@7, and we're planning to upgrade our application to React 19.

I noticed that react-table@7 has a peerDependency that supports React versions up to 18:
"peerDependencies": {
"react": "^16.8.3 || ^17.0.0-0 || ^18.0.0"
}

Are there any known issues or incompatibilities when using react-table@7 with React 19?

Has there been any testing or validation of v7 with React 19 features like strict mode, concurrent rendering, or updated hooks behavior?

Is the team planning to update the peer dependencies or provide an official stance on React 19 support for v7?

Thanks,
Suresh

### Your Minimal, Reproducible Example - (Sandbox Highly Recommended)

..

### Screenshots or Videos (Optional)

_No response_

### Do you intend to try to help solve this bug with your own PR?

None

### Terms & Code of Conduct

- [x] I agree to follow this project's Code of Conduct
- [x] I understand that if my bug cannot be reliable reproduced in a debuggable environment, it will probably not be fixed and this issue may even be closed.

---

## Top Comments

**@luchillo17** (+2):

Afaik the only potentially troublesome part would be the compiler, which the new eslint hooks plugin flags:

<img width="1387" height="375" alt="Image" src="https://github.com/user-attachments/assets/61945ab6-007a-4512-9a05-60376153d71e" />

If I understand correctly the way around this is to use the pragma `"use no memo"`, but the issue where I got it is old, so not sure how up to date that is (last message was in May, the issue was locked to contributors): #5567

...

**@maksnester** (+3):

Same here, would appreciate a patch with peerDeps update in v7. Not eager to look into v8 update right now

**@altanbgn**:

Any update on this? I am getting the same warning