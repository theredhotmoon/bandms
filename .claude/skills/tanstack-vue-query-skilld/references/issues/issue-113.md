---
number: 113
title: Testing patterns
type: other
state: closed
created: 2020-01-22
url: "https://github.com/TanStack/query/issues/113"
reactions: 24
comments: 23
---

# Testing patterns

We are currently using react-query (which is totally awesome) and we find it hard to write thats for code that uses it. There are no examples or guidelines . The options are to either mock http level or mock the function passed to`useQuery`. It would be helpful to have a utility method such as:
`onQuery('resource', () => //return mock data)` that will be used useQuery instead of the queryFn to retrieve data.

Example:
```

//COMPONENT
function Comp () {
 const {data} = useQuery('resources' , () => {....});
return <div>{data}</div>
}

//TEST
it('some test', () => {
onQuery('resource', () => //return mock data)`

//render component

//assert
});
```

I'd love to discussed and create a PR for it

---

## Top Comments

**@tannerlinsley** [maintainer] (+16):

I can only recommend that you use a library like `@testing-library/react` and only test the public api/output of react-query.  React-Query will be difficult to mock outside of returning synchronous data, so I would advise against it, and would instead urge you to simply mock your query functions and variables to react-query.

**@ghostd** (+21):

Hi,

(I write this for the record and maybe to help other people)

Here an example of what i did to test a custom hook wrapping `useQuery`:
...

**@cschwebk** (+14):

@borislit I have been using `sinon` to mock out `useQuery` entirely. Not saying this is the right way to test components that use `reactQuery`, but it's worked for me so far.

```js
import sinon from 'sinon';
import * as reactQuery from 'react-query';

describe('test', () => {
  const sandbox = sinon.createSandbox();

  it('should run the test', () => {
    sandbox.stub(reactQuery, 'useQuery').returns({ data: null, isLoading: false, error: null });

    // etc...
  })
});
```