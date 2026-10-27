<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import QuickAddModal from '@/components/admin/forms/QuickAddModal.vue'
import ConcertQuickAddForm from './ConcertQuickAddForm.vue'
import ReleaseQuickAddForm from './ReleaseQuickAddForm.vue'
import PressQuickAddForm from './PressQuickAddForm.vue'
import ShopItemQuickAddForm from './ShopItemQuickAddForm.vue'
import MemberQuickAddForm from './MemberQuickAddForm.vue'
import TourQuickAddForm from './TourQuickAddForm.vue'
import PostQuickAddForm from './PostQuickAddForm.vue'
import { useCreateConcertWithPoster } from '@/composables/useConcerts'
import { useCreateReleaseWithCover } from '@/composables/useReleases'
import { useCreatePressRelease } from '@/composables/usePressReleases'
import { useCreateShopItem } from '@/composables/useShop'
import { useCreateBandMemberWithPhoto } from '@/composables/useBandMembers'
import { useCreateTour } from '@/composables/useTours'
import { useCreatePost } from '@/composables/usePosts'
import type { ConcertPayload } from '@/types/concert'
import type { ReleasePayload } from '@/types/release'
import type { PressReleasePayload } from '@/types/press-release'
import type { ShopItemPayload } from '@/types/shop'
import type { TourPayload } from '@/types/tour'
import type { PostPayload } from '@/types/post'
import type { BandMemberPayload } from '@bandms/rider-core'

/** The records a picker can create in place: each has a reusable admin form. */
export type QuickAddEntity = 'concert' | 'release' | 'press_release' | 'shop_item' | 'member' | 'tour' | 'post'

/**
 * "+ New …" beside a picker of related records — a post's reference block,
 * the relations panel's sections — opening that entity's own admin form in
 * a modal stacked over the host, creating the record and handing its id
 * back so the host can select it. The record reaches the host's list through
 * the cache append each create-only composable does, so the option is there
 * before the host's list has refetched.
 *
 * Albums and music videos have no reusable form (an album is made by
 * uploading photos, a video by fetching a URL's metadata; both live inline
 * in their pages), so they are not offered. Tags have their own TagQuickAdd.
 *
 * The create functions are mounted here (they fetch nothing); each entity's
 * form and the list queries it needs are a child mounted only while the
 * modal is open, so those lists do not load under every host for a button
 * that may never be pressed.
 */
const props = defineProps<{ entity: QuickAddEntity }>()
const emit = defineEmits<{ created: [id: number] }>()

const { t } = useI18n()
const createConcert = useCreateConcertWithPoster()
const createRelease = useCreateReleaseWithCover()
const createPress = useCreatePressRelease()
const createShop = useCreateShopItem()
const createMember = useCreateBandMemberWithPhoto()
const createTour = useCreateTour()
const createPost = useCreatePost()

// The entity decides which form is mounted, so the payload that arrives is
// that form's; the casts say so where the types cannot.
type Create = (payload: unknown, file: File | null) => Promise<{ id: number }>
interface Config { button: string; title: string; success: string; width: string; create: Create }

const config = computed<Config>(() => {
  switch (props.entity) {
    case 'concert': return {
      button: t('common.quickAdd.concert'), title: t('shows.concerts.modalNew'),
      success: t('shows.concerts.created'), width: '56rem',
      create: (p, f) => createConcert(p as ConcertPayload, f),
    }
    case 'release': return {
      button: t('common.quickAdd.release'), title: t('media.releases.modalNew'),
      success: t('media.releases.created'), width: '56rem',
      create: (p, f) => createRelease(p as ReleasePayload, f),
    }
    case 'press_release': return {
      button: t('common.quickAdd.press'), title: t('content.press.modalNew'),
      success: t('content.press.created'), width: '52rem',
      create: (p) => createPress.mutateAsync(p as PressReleasePayload),
    }
    case 'shop_item': return {
      button: t('common.quickAdd.shopItem'), title: t('more.shop.modalNew'),
      success: t('more.shop.created'), width: '52rem',
      create: (p) => createShop.mutateAsync(p as ShopItemPayload),
    }
    case 'member': return {
      button: t('common.quickAdd.member'), title: t('band.members.add'),
      success: t('band.members.added'), width: '54rem',
      create: (p) => createMember(p as BandMemberPayload),
    }
    case 'tour': return {
      button: t('common.quickAdd.tour'), title: t('shows.tours.modalNew'),
      success: t('shows.tours.created'), width: '52rem',
      create: (p) => createTour.mutateAsync(p as TourPayload),
    }
    case 'post': return {
      button: t('common.quickAdd.post'), title: t('content.posts.modalNew'),
      success: t('content.posts.created'), width: '64rem',
      create: (p) => createPost.mutateAsync(p as PostPayload),
    }
  }
})
</script>

<template>
  <QuickAddModal
    :button-label="config.button"
    :title="config.title"
    :success-message="config.success"
    :max-width="config.width"
    :test-id="`quick-add-${entity}`"
    :create="config.create"
    @created="emit('created', $event.id)"
    v-slot="{ loading, errors, submit, cancel }"
  >
    <ConcertQuickAddForm  v-if="entity === 'concert'"            :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <ReleaseQuickAddForm  v-else-if="entity === 'release'"       :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <PressQuickAddForm    v-else-if="entity === 'press_release'" :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <ShopItemQuickAddForm v-else-if="entity === 'shop_item'"     :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <MemberQuickAddForm   v-else-if="entity === 'member'"        :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <TourQuickAddForm     v-else-if="entity === 'tour'"          :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <PostQuickAddForm     v-else-if="entity === 'post'"          :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
  </QuickAddModal>
</template>
