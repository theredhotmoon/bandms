---
total: 62
---

# Docs Index

- [FAQ](./faq.md): If you are using React, there is a very common pitfall that can cause infinite rendering. If you fail to give your columns, data, or state a stable...
- [Installation](./installation.md): Before we dig in to the API, let's get you set up!
- [Introduction](./introduction.md): TanStack Table is a Headless UI library for building powerful tables & datagrids for TS/JS, React, Vue, Solid, Qwik, and Svelte.
- [Overview](./overview.md): TanStack Table's core is framework agnostic, which means its API is the same regardless of the framework you're using. Adapters are provided to mak...
- [Vanilla TS/JS](./vanilla.md): The @tanstack/table-core library contains the core logic for TanStack Table. If you are using a non-standard framework or don't have access to a fr...

## api/core (7)

- [Cell APIs](./api/core/cell.md): These are core options and API properties for all cells. More options and API properties are available for other table features.
- [ColumnDef APIs](./api/core/column-def.md): Column definitions are plain objects with the following options:
- [Column APIs](./api/core/column.md): These are core options and API properties for all columns. More options and API properties are available for other table features.
- [HeaderGroup APIs](./api/core/header-group.md): These are core options and API properties for all header groups. More options and API properties may be available for other table features.
- [Header APIs](./api/core/header.md): These are core options and API properties for all headers. More options and API properties may be available for other table features.
- [Row APIs](./api/core/row.md): These are core options and API properties for all rows. More options and API properties are available for other table features.
- [Table APIs](./api/core/table.md): These functions are used to create a table. Which one you use depends on which framework adapter you are using.

## api/features (16)

- [Column Faceting APIs](./api/features/column-faceting.md): Returns the row model with all other column filters applied, excluding its own filter. Useful for displaying faceted result counts.
- [Column Filtering APIs](./api/features/column-filtering.md): The ability for a column to be column filtered is determined by the following:
- [Column Ordering APIs](./api/features/column-ordering.md): Column ordering state is stored on the table using the following shape:
- [Column Pinning APIs](./api/features/column-pinning.md): The ability for a column to be pinned is determined by the following:
- [Column Sizing APIs](./api/features/column-sizing.md): Column sizing state is stored on the table using the following shape:
- [Column Visibility APIs](./api/features/column-visibility.md): Column visibility state is stored on the table using the following shape:
- [Expanding APIs](./api/features/expanding.md): Expanding state is stored on the table using the following shape:
- [Filter APIs](./api/features/filters.md): The Filtering API docs are now split into multiple API doc pages:
- [Global Faceting APIs](./api/features/global-faceting.md): Returns the faceted row model for the global filter.
- [Global Filtering APIs](./api/features/global-filtering.md): The ability for a column to be globally filtered is determined by the following:
- [Grouping APIs](./api/features/grouping.md): Grouping state is stored on the table using the following shape:
- [Pagination APIs](./api/features/pagination.md): Pagination state is stored on the table using the following shape:
- [Pinning APIs](./api/features/pinning.md): The pinning apis are now split into multiple api pages:
- [Row Pinning APIs](./api/features/row-pinning.md): The ability for a row to be pinned is determined by the following:
- [Row Selection APIs](./api/features/row-selection.md): Row selection state is stored on the table using the following shape:
- [Sorting APIs](./api/features/sorting.md): Sorting state is stored on the table using the following shape:

## enterprise (1)

- [AG Grid - An alternative enterprise data-grid solution](./enterprise/ag-grid.md): While we clearly love TanStack Table, we acknowledge that it is not a "batteries" included product packed with customer support and enterprise poli...

## framework/vanilla/guide (1)

- [Table State (Vanilla JS) Guide](./framework/vanilla/guide/table-state.md)

## framework/vue/guide (1)

- [Table State (Vue) Guide](./framework/vue/guide/table-state.md): TanStack Table has a simple underlying internal state management system to store and manage the state of the table. It also lets you selectively pu...

## framework/vue (1)

- [Vue Table](./framework/vue/vue-table.md): The @tanstack/vue-table adapter is a wrapper around the core table logic. Most of it's job is related to managing state the "vue" way, providing ty...

## guide (30)

- [Cells Guide](./guide/cells.md): Cell API
- [Columns Definitions Guide](./guide/column-defs.md): Column Def
- [Column Faceting Guide](./guide/column-faceting.md): Want to skip to the implementation? Check out these examples:
- [Column Filtering Guide](./guide/column-filtering.md): Want to skip to the implementation? Check out these examples:
- [Column Ordering Guide](./guide/column-ordering.md): Want to skip to the implementation? Check out these examples:
- [Column Pinning Guide](./guide/column-pinning.md): Want to skip to the implementation? Check out these examples:
- [Column Sizing Guide](./guide/column-sizing.md): Want to skip to the implementation? Check out these examples:
- [Column Visibility Guide](./guide/column-visibility.md): Want to skip to the implementation? Check out these examples:
- [Columns Guide](./guide/columns.md): Column API
- [Custom Features Guide](./guide/custom-features.md): Want to skip to the implementation? Check out these examples:
- [Data Guide](./guide/data.md): Tables start with your data. Your column definitions and rows will depend on the shape of your data. TanStack Table has some TypeScript features th...
- [Expanding Guide](./guide/expanding.md): Want to skip to the implementation? Check out these examples:
- [Features Guide](./guide/features.md): TanStack Table comes with many features, each with their own associated options and API:
- [Filters Guide](./guide/filters.md): The filter guides are now split into multiple guides:
- [Fuzzy Filtering Guide](./guide/fuzzy-filtering.md): Want to skip to the implementation? Check out these examples:
- [Global Faceting Guide](./guide/global-faceting.md): Want to skip to the implementation? Check out these examples:
- [Global Filtering Guide](./guide/global-filtering.md): Want to skip to the implementation? Check out these examples:
- [Grouping Guide](./guide/grouping.md): Want to skip to the implementation? Check out these examples:
- [Header Groups Guide](./guide/header-groups.md): Header Group API
- [Headers Guide](./guide/headers.md): Header API
- [Migrating to V8 Guide](./guide/migrating.md): TanStack Table V8 was a major rewrite of React Table v7 from the ground up in TypeScript. The overall structure/organization of your markup and CSS...
- [Pagination Guide](./guide/pagination.md): Want to skip to the implementation? Check out these examples:
- [Pinning Guide](./guide/pinning.md): Pinning is split into 2 different feature guides:
- [Row Models Guide](./guide/row-models.md): If you take a look at the most basic example of TanStack Table, you'll see a code snippet like this:
- [Row Pinning Guide](./guide/row-pinning.md): Want to skip to the implementation? Check out these examples:
- [Row Selection Guide](./guide/row-selection.md): Want to skip to the implementation? Check out these examples:
- [Rows Guide](./guide/rows.md): Row API
- [Sorting Guide](./guide/sorting.md): Want to skip to the implementation? Check out these examples:
- [Table Instance Guide](./guide/tables.md): Table API
- [Virtualization Guide](./guide/virtualization.md): Want to skip to the implementation? Check out these examples:
