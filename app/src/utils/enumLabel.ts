import type { Composer } from 'vue-i18n'

/**
 * A catalogue label for a *stored* enum value, falling back to the value.
 *
 * vue-i18n returns the keypath itself on a miss, so
 * `$t(`rider.rig.backline.categories.${row.category}`)` prints
 * `rider.rig.backline.categories.amp_rack` into a table cell the moment the
 * database holds a value the catalogue has not caught up with — a legacy row,
 * or one the API gains before the admin does. The maps these replaced all
 * ended in `?? raw`, and dropping that floor during the sweep turned a mildly
 * ugly cell into a leaked keypath.
 *
 * `RiderSheet.vue` keeps exactly this floor for the same data
 * (`t.backlineCategories[b.category] ?? b.category`); this is the admin's half
 * of that rule.
 *
 * Only for values read off a record. A value taken from the enum's own option
 * list cannot miss, and wrapping those would just hide a genuine catalogue gap
 * that `catalogue.spec.ts` is there to catch.
 */
export function enumLabel(t: Composer['t'], key: string, raw: string): string {
  const label = t(key)
  return label === key ? raw : label
}
