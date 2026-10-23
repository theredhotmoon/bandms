<script setup lang="ts">
import { ref } from 'vue'
import ShopItemForm from '@/components/admin/forms/ShopItemForm.vue'
import { useShop } from '@/composables/useShop'
import { useShopCategories } from '@/composables/useShopCategories'
import { useTags } from '@/composables/useTags'
import { useReleases } from '@/composables/useReleases'
import { useConcerts } from '@/composables/useConcerts'
import { usePosts } from '@/composables/usePosts'
import { useMusicVideos } from '@/composables/useMusicVideos'
import type { PostFilters } from '@/api/posts'
import type { ShopItemPayload } from '@/types/shop'

/**
 * The shop-item form with the lists it needs, for RefQuickAdd's slot. Photos
 * are an edit-only affair on the shop page too (they need the item's id), so
 * a quick-add item gets its pictures there, exactly as a freshly created one
 * does.
 */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: ShopItemPayload]; cancel: [] }>()

const { currenciesQuery } = useShop()
const categoriesQ = useShopCategories()
const { query: tagsQ } = useTags()
const { query: releasesQ } = useReleases()
const { query: concertsQ } = useConcerts()
const postsQ = usePosts(ref<PostFilters>({}))
const { query: videosQ } = useMusicVideos()
</script>

<template>
  <ShopItemForm
    :initial="null"
    :item-id="null"
    :currencies="currenciesQuery.data.value ?? []"
    :categories="categoriesQ.query.data.value ?? []"
    :tags="tagsQ.data.value ?? []"
    :releases="releasesQ.data.value ?? []"
    :concerts="concertsQ.data.value ?? []"
    :posts="postsQ.query.data.value?.data ?? []"
    :videos="videosQ.data.value ?? []"
    :loading="loading"
    :errors="errors"
    @submit="emit('submit', $event)"
    @cancel="emit('cancel')"
  />
</template>
