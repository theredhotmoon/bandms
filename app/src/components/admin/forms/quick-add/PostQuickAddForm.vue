<script setup lang="ts">
import PostForm from '@/components/admin/forms/PostForm.vue'
import { useTags } from '@/composables/useTags'
import { useConcerts } from '@/composables/useConcerts'
import { useBandMembers } from '@/composables/useBandMembers'
import { useAlbums } from '@/composables/useAlbums'
import { useReleases } from '@/composables/useReleases'
import { useMusicVideos } from '@/composables/useMusicVideos'
import { usePressReleases } from '@/composables/usePressReleases'
import { useShop } from '@/composables/useShop'
import { useClips } from '@/composables/useClips'
import type { PostPayload } from '@/types/post'

/**
 * The post form with every list its relations and reference blocks need, for
 * EntityQuickAdd's slot. The heaviest of the quick-add forms, which is why it
 * is mounted only while its modal is open.
 */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: PostPayload]; cancel: [] }>()

const { query: tagsQ } = useTags()
const { query: concertsQ } = useConcerts()
const { query: membersQ } = useBandMembers()
const { query: albumsQ } = useAlbums()
const { query: releasesQ } = useReleases()
const { query: musicVideosQ } = useMusicVideos()
const { query: pressReleasesQ } = usePressReleases()
const { query: shopItemsQ } = useShop()
const { query: clipsQ } = useClips()
</script>

<template>
  <PostForm
    :initial="null"
    :tags="tagsQ.data.value ?? []"
    :concerts="concertsQ.data.value ?? []"
    :members="membersQ.data.value ?? []"
    :albums="albumsQ.data.value ?? []"
    :releases="releasesQ.data.value ?? []"
    :music-videos="musicVideosQ.data.value ?? []"
    :press-releases="pressReleasesQ.data.value ?? []"
    :shop-items="shopItemsQ.data.value ?? []"
    :clips="clipsQ.data.value ?? []"
    :loading="loading"
    :errors="errors"
    @submit="emit('submit', $event)"
    @cancel="emit('cancel')"
  />
</template>
