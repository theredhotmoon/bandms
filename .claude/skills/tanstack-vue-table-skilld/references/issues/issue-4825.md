---
number: 4825
title: implement full width resize handler
type: other
state: open
created: 2023-04-23
url: "https://github.com/TanStack/table/issues/4825"
reactions: 21
comments: 8
---

# implement full width resize handler

### Describe the bug

The `header.getResizeHandler()` works well if the table is not full-width. But when working with full-width tables, it does not handle the `ColumnSizingState` properly.

### Your minimal, reproducible example

none

### Steps to reproduce

**My idea** is that we need full-width Resize Handler apart from normal Resize Handler when the table is full-width.

The normal Resize Handler updates the current column size in the `ColumnSizingState`, but full-width Resize Handler will update the size of **both** the current column and the next resizable column in the `ColumnSizingState`.

The logic is simple -->
+ if there is ANY resizable column after the current column (not need be adjacent, meaning one of the next columns), update the current column size like normal resize handler, and also, update the size of the FIRST resizable column as many as amount of the width change in negative to keep the table width the same.
+ if there is NO resizable column after the current column, do not update the current column size.
+ while updating the `ColumnSizingState`, respect the min width of the current column and the the FIRST resizable column in order to keep the column sizes in stable.

### Expected behavior

**I am volunteer to implement the full-width resize handler.**

**I want to get the package authors' idea and also others' about the way of implementation.** 

_(assume we have a state variable for full width called `isFullWidth`)_

#### Option-1
to create a separate resize handler  --> header.getFullWidthResizeHandler()

the usage could be in the table:
```js
<div
  {...{
    onMouseDown: isFullWidth ? header.getFullWidthResizeHandler() : header.getResizeHandler(),
    onTouchStart: isFullWidth ? header.getFullWidthResizeHandler() : header.getResizeHandler(),
  }}
/>
```

#### Option-2
to update the current getResizeHandler() having a parameter for full-width  --> header.getResizeHandler(isFullWidth)

the usage...

---

## Top Comments

**@alexbu92** (+8):

I see a clear need for this, the current resize handler does not work for full-width tables, the columnSizing table state and actual column sizes quickly get out of sync such that if you save the state to local storage and try to use that as initial state you get significantly different results. The reason is the same as the one @talatkuyuk is referring to, namely that the onColumnSizingChange updater only passes the updated width of the column you are currently resizing, even though many times other columns are also changing widths to be able to take up the entire width.  

If someone has a...

**@underscore05** (+1):

In my case. If I'm using a full width table. I usually  set the last column's width to undefined so the other column sizes will be honored. I think the problem occurs if the sum of all the column width doesn't match with the actual table width. Therefore distributing the remaining width to all the columns. 

**Scenario:**
- Table's actual width is 1000px
- Table has 3 columns and each column has 150px as default. 
- The sum of all the columns is 450px as compared to 1000px.
- The remaining 550px will be distributed evenly to the 3 columns.
- Making each column have 333.33px in actual wi...

**@Jaime02** (+2):

Hey, any update on this issue?  It has been reported multiple times but no definitive answer has been given
The solution proposed by @antoniobeltran is quite good but not perfect. Thank you so much!