<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSiteRebuild } from '@/composables/useSiteRebuild'
import { useContentLocaleOrder } from '@/composables/useContentLocales'
import { postPreviewUrl, previewNote } from '@/utils/postPreview'

/**
 * "Preview" on a draft: opens the page the public build baked under the
 * post's secret token, in the band's first content language. The page is a
 * build, not the editor, so it also says when it lags — unsaved
 * edits, a build running, or saved changes no build has picked up yet.
 */
const props = withDefaults(defineProps<{
  token?: string | null
  /** The editor holds unsaved changes. */
  dirty?: boolean
}>(), { token: null, dirty: false })

const { t } = useI18n()
const order = useContentLocaleOrder()
const { isBuilding, pendingAreas } = useSiteRebuild()

const href = computed(() => postPreviewUrl(order.value[0], props.token))
const note = computed(() => previewNote({
  dirty: props.dirty,
  building: isBuilding.value,
  postsPending: pendingAreas.value.some(a => a.area === 'posts'),
}))
</script>

<template>
  <span v-if="href" class="pp">
    <a
      :href="href" target="_blank" rel="noopener"
      class="btn-ghost" :title="t('content.posts.preview.title')"
      data-testid="post-preview-link"
    >{{ t('content.posts.preview.open') }} ↗</a>
    <span v-if="note" class="pp-note" data-testid="post-preview-note" :data-note="note">{{ t(`content.posts.preview.${note}`) }}</span>
  </span>
</template>

<style scoped src="./form-styles.css" />
<style scoped>
.pp { display: inline-flex; align-items: center; gap: 0.625rem; min-width: 0; }
.pp a { text-decoration: none; display: inline-flex; align-items: center; }
.pp-note { font-size: var(--fs-xs); color: var(--c-94a3b8); }
</style>
