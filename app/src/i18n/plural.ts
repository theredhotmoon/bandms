import { polishPluralIndex } from '@/utils/uiLocale'

/**
 * vue-i18n hands us the count and how many `|`-separated choices the message
 * actually has. Clamping matters: a two-choice Polish message would otherwise
 * be asked for index 2 and render nothing.
 */
export const pluralRules = {
  pl: (choice: number, choicesLength: number): number =>
    Math.min(polishPluralIndex(choice), Math.max(choicesLength - 1, 0)),
}
