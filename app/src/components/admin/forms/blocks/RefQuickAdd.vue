<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import QuickAddModal from '@/components/admin/forms/QuickAddModal.vue'
import RefQuickAddConcert from './RefQuickAddConcert.vue'
import RefQuickAddRelease from './RefQuickAddRelease.vue'
import RefQuickAddPress from './RefQuickAddPress.vue'
import RefQuickAddShopItem from './RefQuickAddShopItem.vue'
import { useCreateConcertWithPoster } from '@/composables/useConcerts'
import { useCreateReleaseWithCover } from '@/composables/useReleases'
import { useCreatePressRelease } from '@/composables/usePressReleases'
import { useCreateShopItem } from '@/composables/useShop'
import type { RefEntity } from '@/types/post'
import type { ConcertPayload } from '@/types/concert'
import type { ReleasePayload } from '@/types/release'
import type { PressReleasePayload } from '@/types/press-release'
import type { ShopItemPayload } from '@/types/shop'

/**
 * "+ New …" beside a reference block's item select: opens that entity's own
 * admin form in a modal stacked over the post, creates the record, and hands
 * its id back so the block can point at it. The record reaches the block's
 * option list through the cache append each create-only composable does, so
 * the option is there before the host's list has refetched.
 *
 * Only the entities whose create flow is a reusable form are offered. An
 * album is made by uploading photos and a music video by fetching a URL's
 * metadata; both live inline in their views and are left to those pages. A
 * clip has its own "Add a new clip…" in the block already.
 *
 * The create functions are mounted here (they fetch nothing); each entity's
 * form and the list queries it needs are a child mounted only while the
 * modal is open, so those lists do not load under every post for a button
 * that may never be pressed.
 */
const props = defineProps<{ entity: RefEntity }>()
const emit = defineEmits<{ created: [id: number] }>()

const { t } = useI18n()
const createConcert = useCreateConcertWithPoster()
const createRelease = useCreateReleaseWithCover()
const createPress = useCreatePressRelease()
const createShop = useCreateShopItem()

// The entity select decides which form is mounted, so the payload that
// arrives is that form's; the casts say so where the types cannot.
type RefCreate = (payload: unknown, file: File | null) => Promise<{ id: number }>
interface RefConfig { button: string; title: string; success: string; width: string; create: RefCreate }

const config = computed<RefConfig | undefined>(() => {
  switch (props.entity) {
    case 'concert': return {
      button: t('content.blocks.ref.newEntity.concert'), title: t('shows.concerts.modalNew'),
      success: t('shows.concerts.created'), width: '56rem',
      create: (p, f) => createConcert(p as ConcertPayload, f),
    }
    case 'release': return {
      button: t('content.blocks.ref.newEntity.release'), title: t('media.releases.modalNew'),
      success: t('media.releases.created'), width: '56rem',
      create: (p, f) => createRelease(p as ReleasePayload, f),
    }
    case 'press_release': return {
      button: t('content.blocks.ref.newEntity.press'), title: t('content.press.modalNew'),
      success: t('content.press.created'), width: '52rem',
      create: (p) => createPress.mutateAsync(p as PressReleasePayload),
    }
    case 'shop_item': return {
      button: t('content.blocks.ref.newEntity.shop'), title: t('more.shop.modalNew'),
      success: t('more.shop.created'), width: '52rem',
      create: (p) => createShop.mutateAsync(p as ShopItemPayload),
    }
    default: return undefined
  }
})
</script>

<template>
  <QuickAddModal
    v-if="config"
    :button-label="config.button"
    :title="config.title"
    :success-message="config.success"
    :max-width="config.width"
    test-id="ref-quick-add"
    :create="config.create"
    @created="emit('created', $event.id)"
    v-slot="{ loading, errors, submit, cancel }"
  >
    <RefQuickAddConcert  v-if="entity === 'concert'"            :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <RefQuickAddRelease  v-else-if="entity === 'release'"       :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <RefQuickAddPress    v-else-if="entity === 'press_release'" :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <RefQuickAddShopItem v-else-if="entity === 'shop_item'"     :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
  </QuickAddModal>
</template>
