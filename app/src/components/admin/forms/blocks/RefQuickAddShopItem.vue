<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import ShopItemForm from '@/components/admin/forms/ShopItemForm.vue'
import { useShop } from '@/composables/useShop'
import { useShopCategories } from '@/composables/useShopCategories'
import { useTags } from '@/composables/useTags'
import { useReleases } from '@/composables/useReleases'
import { useConcerts } from '@/composables/useConcerts'
import { usePosts } from '@/composables/usePosts'
import { useMusicVideos } from '@/composables/useMusicVideos'
import { reportSaveError } from '@/utils/formErrors'
import type { PostFilters } from '@/api/posts'
import type { ShopItemPayload } from '@/types/shop'

/**
 * The shop-item half of RefQuickAdd — the shop page's form and save. Photos
 * are an edit-only affair there too (they need the item's id), so a quick-add
 * item gets its pictures on the Shop page, exactly as a freshly created one
 * does there.
 */
const emit = defineEmits<{ created: [id: number]; cancel: [] }>()

const { t } = useI18n()
const { currenciesQuery, create } = useShop()
const categoriesQ = useShopCategories()
const { query: tagsQ } = useTags()
const { query: releasesQ } = useReleases()
const { query: concertsQ } = useConcerts()
const postsQ = usePosts(ref<PostFilters>({}))
const { query: videosQ } = useMusicVideos()

const fieldErrors = ref<Record<string, string[]>>({})

async function handleSubmit(payload: ShopItemPayload): Promise<void> {
  fieldErrors.value = {}
  try {
    const item = await create.mutateAsync(payload)
    toast.success(t('more.shop.created'))
    emit('created', item.id)
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
  }
}
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
    :loading="create.isPending.value"
    :errors="fieldErrors"
    @submit="handleSubmit"
    @cancel="emit('cancel')"
  />
</template>
