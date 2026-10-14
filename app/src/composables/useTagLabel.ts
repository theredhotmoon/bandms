import { useContentLocaleOrder } from './useContentLocales'
import { tagLabel, type TagNameSource } from '@/utils/localeOrder'

/** `tagLabel` bound to the band's content-language order — see utils/localeOrder. */
export function useTagLabel(): (tag: TagNameSource) => string {
  const order = useContentLocaleOrder()
  return (tag) => tagLabel(tag, order.value)
}
