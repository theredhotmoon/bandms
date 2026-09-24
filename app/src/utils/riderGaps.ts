import type { Composer } from 'vue-i18n'

/**
 * Turn `placementStatus().missing` into a phrase the reader's language.
 *
 * `placementStatus()` lives in `@bandms/rider-core`, which has no catalogue
 * and must not acquire one — it is shared with the public site, which resolves
 * its strings a completely different way. So it returns *stable keys*
 * (`'instrument' | 'inputs' | 'monitor'`), and the admin does the wording.
 *
 * It used to return those same three words and both call sites joined them
 * straight into a translated frame, so Polish read "brak: inputs, monitor" in
 * the completeness bar and in the publish-blocking warning. Nothing could see
 * it: the values are produced in a package none of `app/`'s i18n guards walk,
 * and by the time they reach a template they are a bound expression, not text.
 *
 * An unknown key prints itself rather than vanishing — a gap list that silently
 * dropped an entry would say the rider is more complete than it is.
 */
export function gapWords(missing: string[], t: Composer['t']): string {
  return missing
    .map((key) => {
      const path = `rider.completeness.gaps.${key}`
      const word = t(path)
      return word === path ? key : word
    })
    .join(', ')
}
