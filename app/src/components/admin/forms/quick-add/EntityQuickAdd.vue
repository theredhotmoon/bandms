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
import AlbumQuickAddForm from './AlbumQuickAddForm.vue'
import MusicVideoQuickAddForm from './MusicVideoQuickAddForm.vue'
import { useCreateConcertWithPoster } from '@/composables/useConcerts'
import { useCreateReleaseWithCover } from '@/composables/useReleases'
import { useCreatePressRelease } from '@/composables/usePressReleases'
import { useCreateShopItem } from '@/composables/useShop'
import { useCreateBandMemberWithPhoto } from '@/composables/useBandMembers'
import { useCreateTour } from '@/composables/useTours'
import { useCreatePost } from '@/composables/usePosts'
import { useCreateAlbumWithPhotos, type AlbumUpload } from '@/composables/useAlbums'
import { useCreateMusicVideo } from '@/composables/useMusicVideos'
import type { ConcertPayload } from '@/types/concert'
import type { ReleasePayload } from '@/types/release'
import type { PressReleasePayload } from '@/types/press-release'
import type { ShopItemPayload } from '@/types/shop'
import type { TourPayload } from '@/types/tour'
import type { PostPayload } from '@/types/post'
import type { BandMemberPayload } from '@bandms/rider-core'
import type { MusicVideoPayload } from '@/types/musicVideo'

/** The records a picker can create in place: each has a reusable admin form. */
export type QuickAddEntity = 'concert' | 'release' | 'press_release' | 'shop_item' | 'member' | 'tour' | 'post' | 'album' | 'music_video'

/**
 * "+ New …" beside a picker of related records — a post's reference block,
 * the relations panel's sections — opening that entity's own admin form in
 * a modal stacked over the host, creating the record and handing its id
 * back so the host can select it. The record reaches the host's list through
 * the cache append each create-only composable does, so the option is there
 * before the host's list has refetched.
 *
 * Tags have their own TagQuickAdd. An album is created with its photos, the
 * way the Photos page does it (the form asks for at least one).
 *
 * The create functions are mounted here (they fetch nothing); each entity's
 * form and the list queries it needs are a child mounted only while the
 * modal is open, so those lists do not load under every host for a button
 * that may never be pressed.
 */
const props = defineProps<{ entity: QuickAddEntity }>()
const emit = defineEmits<{ created: [id: number] }>()

const { t } = useI18n()

// One create per instance: `entity` is fixed for an instance's lifetime (hosts
// key on it), so only that entity's composable is mounted — a press form
// renders a handful of these and a post one per reference block, and each
// must not carry every create mutation for a button that may never be
// pressed. The entity decides which form is mounted, so the payload that
// arrives is that form's; the casts say so where the types cannot.
type Create = (payload: unknown, file: File | null) => Promise<{ id: number }>
interface Config { button: string; title: string; success: string; width: string; create: Create }

const FACTORIES: Record<QuickAddEntity, () => Omit<Config, 'button' | 'title' | 'success'>> = {
  concert: () => {
    const create = useCreateConcertWithPoster()
    return { width: '56rem', create: (p, f) => create(p as ConcertPayload, f) }
  },
  release: () => {
    const create = useCreateReleaseWithCover()
    return { width: '56rem', create: (p, f) => create(p as ReleasePayload, f) }
  },
  press_release: () => {
    const create = useCreatePressRelease()
    return { width: '52rem', create: (p) => create.mutateAsync(p as PressReleasePayload) }
  },
  shop_item: () => {
    const create = useCreateShopItem()
    return { width: '52rem', create: (p) => create.mutateAsync(p as ShopItemPayload) }
  },
  member: () => {
    const create = useCreateBandMemberWithPhoto()
    return { width: '54rem', create: (p) => create(p as BandMemberPayload) }
  },
  tour: () => {
    const create = useCreateTour()
    return { width: '52rem', create: (p) => create.mutateAsync(p as TourPayload) }
  },
  post: () => {
    const create = useCreatePost()
    return { width: '64rem', create: (p) => create.mutateAsync(p as PostPayload) }
  },
  album: () => {
    const create = useCreateAlbumWithPhotos()
    return { width: '64rem', create: (p) => create(p as AlbumUpload) }
  },
  music_video: () => {
    const create = useCreateMusicVideo()
    return { width: '32rem', create: (p) => create.mutateAsync(p as MusicVideoPayload) }
  },
}
const mounted = FACTORIES[props.entity]()

const LABELS: Record<QuickAddEntity, () => Pick<Config, 'button' | 'title' | 'success'>> = {
  concert:       () => ({ button: t('common.quickAdd.concert'),    title: t('shows.concerts.modalNew'),  success: t('shows.concerts.created') }),
  release:       () => ({ button: t('common.quickAdd.release'),    title: t('media.releases.modalNew'),  success: t('media.releases.created') }),
  press_release: () => ({ button: t('common.quickAdd.press'),      title: t('content.press.modalNew'),   success: t('content.press.created') }),
  shop_item:     () => ({ button: t('common.quickAdd.shopItem'),   title: t('more.shop.modalNew'),       success: t('more.shop.created') }),
  member:        () => ({ button: t('common.quickAdd.member'),     title: t('band.members.add'),         success: t('band.members.added') }),
  tour:          () => ({ button: t('common.quickAdd.tour'),       title: t('shows.tours.modalNew'),     success: t('shows.tours.created') }),
  post:          () => ({ button: t('common.quickAdd.post'),       title: t('content.posts.modalNew'),   success: t('content.posts.created') }),
  album:         () => ({ button: t('common.quickAdd.album'),      title: t('media.photos.modalNew'),    success: t('media.photos.albumAdded') }),
  music_video:   () => ({ button: t('common.quickAdd.musicVideo'), title: t('media.videos.modalNew'),    success: t('media.videos.added') }),
}
const config = computed<Config>(() => ({ ...mounted, ...LABELS[props.entity]() }))
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
    <AlbumQuickAddForm    v-else-if="entity === 'album'"         :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
    <MusicVideoQuickAddForm v-else-if="entity === 'music_video'" :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
  </QuickAddModal>
</template>
