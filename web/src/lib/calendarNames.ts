import type { Locale } from '@/types/shared'

/**
 * Month and weekday names for the availability calendar. Locale data, not
 * band copy — keyed by the registry, so a third locale is a compile error here.
 * Shared by every page that mounts the calendar (contact, concerts, home).
 */
const CALENDAR_NAMES: Record<Locale, { months: readonly string[]; weekdays: readonly string[] }> = {
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June',
             'July', 'August', 'September', 'October', 'November', 'December'],
    weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  },
  pl: {
    months: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
             'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'],
    weekdays: ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'],
  },
}

export function calendarNames(lang: Locale) {
  return CALENDAR_NAMES[lang] ?? CALENDAR_NAMES.en
}
