<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import CrawlerSettingsForm from '@/components/admin/assistant/CrawlerSettingsForm.vue'
import { ApiError } from '@/api/client'
import { useCrawlerSettings } from '@/composables/useCrawlerSettings'
import { adminUrl } from '@/config/admin'
import type { CrawlerSettings } from '@/types/assistantCrawler'
import { reportSaveError } from '@/utils/formErrors'

const { t } = useI18n()
const { query, save, searchArtists } = useCrawlerSettings()

// The settings decide how much of each provider's quota is spent, so the
// server keeps them to superadmins; an admin who is not one gets a 403.
const forbidden = computed(() => query.error.value instanceof ApiError && query.error.value.status === 403)

async function handleSave(settings: CrawlerSettings) {
  try {
    await save.mutateAsync(settings)
    toast.success(t('more.assistant.settings.saved'))
  } catch (e) { reportSaveError(e, t('more.assistant.settings.saveFailed')) }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <RouterLink :to="adminUrl('assistant')" class="text-sm" style="color:var(--c-94a3b8);">{{ $t('more.assistant.settings.back') }}</RouterLink>
      <h1 class="text-lg font-semibold mt-2 mb-1" style="color:var(--c-e2e8f0);">{{ $t('more.assistant.settings.title') }}</h1>
      <p class="mb-6 text-sm" style="color:var(--c-94a3b8);">{{ $t('more.assistant.settings.lead') }}</p>

      <p v-if="query.isPending.value" style="color:var(--c-94a3b8);">{{ $t('common.state.loading') }}</p>
      <p v-else-if="forbidden" data-testid="crawler-settings-forbidden" style="color:var(--c-94a3b8);">{{ $t('more.assistant.settings.forbidden') }}</p>
      <p v-else-if="query.isError.value" style="color:var(--c-f87171);">{{ $t('more.assistant.settings.loadFailed') }}</p>
      <CrawlerSettingsForm v-else-if="query.data.value" :initial="query.data.value" :saving="save.isPending.value" :search-artists="searchArtists" @save="handleSave" />
    </div>
  </AdminLayout>
</template>
