import { computed, ref, watch, type Ref } from 'vue'

export function useTableControls<T extends object>(options: {
  data: Ref<T[] | undefined> | Ref<T[]>
  searchFn?: (row: T, query: string) => boolean
  defaultSort?: string
  defaultDir?: 'asc' | 'desc'
  perPage?: number
}) {
  const { data, searchFn, defaultSort = '', defaultDir = 'asc', perPage = 15 } = options

  const search = ref('')
  const sortKey = ref(defaultSort)
  const sortDir = ref<'asc' | 'desc'>(defaultDir)
  const page = ref(1)

  const rawTotal = computed(() => data.value?.length ?? 0)

  // Reset page on search/sort change OR when underlying dataset changes (external filters)
  watch([search, sortKey, sortDir, rawTotal], () => { page.value = 1 })

  const filtered = computed<T[]>(() => {
    let rows: T[] = data.value ?? []

    if (search.value && searchFn) {
      const q = search.value.toLowerCase()
      rows = rows.filter((row) => searchFn(row, q))
    }

    if (sortKey.value) {
      const k = sortKey.value
      rows = [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[k]
        const bv = (b as Record<string, unknown>)[k]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        const cmp = String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
        return sortDir.value === 'asc' ? cmp : -cmp
      })
    }

    return rows
  })

  const total = computed(() => filtered.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / perPage)))
  const from = computed(() => (total.value === 0 ? 0 : (page.value - 1) * perPage + 1))
  const to = computed(() => Math.min(page.value * perPage, total.value))

  const paginated = computed<T[]>(() => {
    const start = (page.value - 1) * perPage
    return filtered.value.slice(start, start + perPage)
  })

  function toggleSort(key: string) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = 'asc'
    }
  }

  return {
    search,
    sortKey,
    sortDir,
    page,
    perPage,
    rawTotal,
    filtered,
    paginated,
    total,
    totalPages,
    from,
    to,
    toggleSort,
  }
}
