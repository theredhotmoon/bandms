<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useBlockedSites } from '@/composables/useAssistantFindings'
import { useUiLang } from '@/composables/useUiLang'
import type { BlockedSite } from '@/types/assistantCrawler'
import { formatShortDate } from '@/utils/formatDate'
import { reportSaveError } from '@/utils/formErrors'

/**
 * What "Wrong → block the whole site" blocked, folded under the inbox, with
 * Unblock. Renders nothing until something is blocked.
 */
const { t } = useI18n()
const { uiLang } = useUiLang()
const { query, unblock } = useBlockedSites()

async function remove(site: BlockedSite) {
  try {
    await unblock.mutateAsync(site.id)
    toast.success(t('more.assistant.blocked.done', { site: site.label }))
  } catch (e) { reportSaveError(e, t('more.assistant.blocked.failed')) }
}
</script>

<template>
  <details v-if="query.data.value?.length" class="bs" data-testid="blocked-sites">
    <summary class="bs-summary">{{ $t('more.assistant.blocked.title') }} ({{ query.data.value.length }})</summary>
    <p class="bs-lead">{{ $t('more.assistant.blocked.lead') }}</p>
    <ul class="bs-list">
      <li v-for="s in query.data.value" :key="s.id" class="bs-row" :data-site="s.key">
        <span class="bs-label">{{ s.label }}</span>
        <span class="bs-meta">{{ formatShortDate(s.created_at, uiLang, 'instant') }}<template v-if="s.created_by"> · {{ s.created_by }}</template></span>
        <button type="button" class="btn-ghost" :disabled="unblock.isPending.value" @click="remove(s)">
          {{ $t('more.assistant.blocked.unblock') }}
        </button>
      </li>
    </ul>
  </details>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.bs { margin-top: 1.5rem; }
.bs-summary { cursor: pointer; font-size: var(--fs-sm); font-weight: 600; color: var(--c-e2e8f0); }
.bs-lead { margin: 0.5rem 0 0.75rem; font-size: var(--fs-sm); color: var(--c-94a3b8); }
.bs-list { display: flex; flex-direction: column; border: 1px solid var(--c-333333); border-radius: 0.5rem; }
.bs-row {
  display: flex; gap: 1rem; align-items: center; padding: 0.5rem 0.9rem;
  border-bottom: 1px solid var(--c-333333);
}
.bs-row:last-child { border-bottom: none; }
.bs-label { flex: 1; min-width: 0; font-size: var(--fs-sm); color: var(--c-e2e8f0); overflow-wrap: anywhere; }
.bs-meta { font-size: var(--fs-xs); color: var(--c-94a3b8); white-space: nowrap; }
</style>
