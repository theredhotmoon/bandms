import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useBands } from './useBands'
import { defaultContact } from '@/utils/pitchRecipient'
import type { BandContact } from '@/types/band'

export interface BandContactPrefill {
  /** The band's assigned contact people, empty until the bands query lands. */
  contacts: ComputedRef<BandContact[]>
  selectedContactId: Ref<number | null>
  chooseContact: (id: number) => void
}

/**
 * Addresses a band pitch to one of the band's assigned contacts.
 *
 * The bands query resolves after mount, so the swap cannot happen in setup —
 * it runs when the data lands. That makes it capable of overwriting something
 * typed in the meantime, hence two guards: it acts only while no contact has
 * been chosen, and only while the recipient still holds the band name it was
 * seeded with.
 */
export function useBandContactPrefill(
  bandId: number | null,
  bandName: string,
  recipientName: Ref<string>,
): BandContactPrefill {
  const { query } = useBands()

  const contacts = computed<BandContact[]>(() =>
    bandId === null ? [] : query.data.value?.find((b) => b.id === bandId)?.contacts ?? [],
  )

  const selectedContactId = ref<number | null>(null)

  function apply(contact: BandContact) {
    selectedContactId.value = contact.id
    recipientName.value = contact.name
  }

  watch(
    contacts,
    (list) => {
      if (selectedContactId.value !== null) return
      if (recipientName.value.trim() !== bandName.trim()) return

      const contact = defaultContact(list)
      if (contact) apply(contact)
    },
    { immediate: true },
  )

  function chooseContact(id: number) {
    const contact = contacts.value.find((c) => c.id === id)
    if (contact) apply(contact)
  }

  return { contacts, selectedContactId, chooseContact }
}
