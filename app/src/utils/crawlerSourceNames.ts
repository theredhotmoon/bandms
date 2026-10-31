type T = (key: string) => string

/**
 * A crawler source's display name. Explicit branches rather than a computed
 * key, so the i18n key guard can resolve each one; an unknown source (a
 * newer server than this bundle) shows its key.
 */
export function sourceName(key: string, t: T): string {
  switch (key) {
    case 'google_cse': return t('more.assistant.settings.sourceNames.google_cse')
    case 'youtube':    return t('more.assistant.settings.sourceNames.youtube')
    case 'setlistfm':  return t('more.assistant.settings.sourceNames.setlistfm')
    case 'places':     return t('more.assistant.settings.sourceNames.places')
    case 'meta_own':   return t('more.assistant.settings.sourceNames.meta_own')
    case 'reddit':     return t('more.assistant.settings.sourceNames.reddit')
    case 'rss':        return t('more.assistant.settings.sourceNames.rss')
    default:           return key
  }
}
