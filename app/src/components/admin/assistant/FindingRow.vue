<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiLang } from '@/composables/useUiLang'
import type { Finding, LeadType } from '@/types/assistantCrawler'
import { countryName } from '@/utils/contactCodes'
import { sourceName } from '@/utils/crawlerSourceNames'
import SaveAsMenu from './SaveAsMenu.vue'

const props = defineProps<{
  finding: Finding
  busy: boolean
  /** A record Save as… created whose link failed — offered again instead of a second create. */
  pendingLink?: { type: 'venue' | 'band' | 'author'; id: number } | null
}>()
const emit = defineEmits<{ dismiss: []; restore: []; saved: [link: { type: 'venue' | 'band' | 'author'; id: number }] }>()

const { t } = useI18n()
const { uiLang } = useUiLang()

// The URL came off the open web: link it only if it is http(s), never a
// javascript: or data: URL a hostile page could have planted in a result.
const href = computed(() => (/^https?:\/\//i.test(props.finding.url) ? props.finding.url : null))

// Any new lead can be saved. A "known" match stays a warning badge only: the
// match is fuzzy ("Klub Studio" vs "Klub Studnia"), so it must not block.
const canSave = computed(() => props.finding.kind === 'lead' && props.finding.status === 'new')

function knownLabel(k: NonNullable<Finding['known']>): string {
  switch (k.type) {
    case 'venue':  return t('more.assistant.known.venue', { name: k.name })
    case 'band':   return t('more.assistant.known.band', { name: k.name })
    default:       return t('more.assistant.known.author', { name: k.name })
  }
}

function leadLabel(type: LeadType): string {
  switch (type) {
    case 'venue':    return t('more.assistant.leadTypes.venue')
    case 'promoter': return t('more.assistant.leadTypes.promoter')
    case 'festival': return t('more.assistant.leadTypes.festival')
    case 'band':     return t('more.assistant.leadTypes.band')
    case 'media':    return t('more.assistant.leadTypes.media')
    default:         return t('more.assistant.leadTypes.profile')
  }
}
</script>

<template>
  <article class="fr" data-testid="finding-row" :data-finding-id="finding.id">
    <div class="fr-main">
      <h3 class="fr-title">{{ finding.title }}</h3>
      <p v-if="finding.summary" class="fr-summary">{{ finding.summary }}</p>
      <p v-else-if="finding.snippet" class="fr-snippet">{{ finding.snippet }}</p>
      <div class="fr-meta">
        <span class="fr-badge">{{ sourceName(finding.source, t) }}</span>
        <span v-if="finding.lead_type" class="fr-badge">{{ leadLabel(finding.lead_type) }}</span>
        <span v-if="finding.country">{{ countryName(finding.country, uiLang) }}</span>
        <span v-if="finding.score > 0">{{ $t('more.assistant.score', { n: finding.score }) }}</span>
        <span v-if="finding.known" class="fr-badge" data-testid="finding-known">{{ knownLabel(finding.known) }}</span>
        <span v-if="finding.duplicate_of" class="fr-badge">{{ $t('more.assistant.duplicate') }}</span>
        <span v-if="finding.status === 'saved'" class="fr-badge fr-badge--saved" data-testid="finding-saved">{{ $t('more.assistant.savedBadge') }}</span>
      </div>
    </div>
    <div class="fr-actions">
      <a v-if="href" :href="href" target="_blank" rel="noopener noreferrer" class="btn-ghost">{{ $t('more.assistant.open') }}</a>
      <button v-if="canSave && pendingLink" type="button" class="btn-ghost" data-testid="finding-relink" :disabled="busy" @click="emit('saved', pendingLink)">
        {{ $t('more.assistant.saveAs.relink') }}
      </button>
      <SaveAsMenu v-else-if="canSave" :finding="finding" @saved="emit('saved', $event)" />
      <button v-if="finding.status === 'dismissed'" type="button" class="btn-ghost" :disabled="busy" @click="emit('restore')">
        {{ $t('more.assistant.restore') }}
      </button>
      <button v-else-if="finding.status === 'new'" type="button" class="btn-ghost" :disabled="busy" @click="emit('dismiss')">
        {{ $t('more.assistant.dismiss') }}
      </button>
    </div>
  </article>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.fr {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--c-333333);
}
.fr:last-child { border-bottom: none; }
.fr-main { min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.fr-title { font-size: var(--fs-sm); font-weight: 600; color: var(--c-e2e8f0); overflow-wrap: anywhere; }
.fr-summary, .fr-snippet { font-size: var(--fs-sm); color: var(--c-94a3b8); overflow-wrap: anywhere; }
.fr-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; font-size: var(--fs-xs); color: var(--c-94a3b8); }
.fr-badge { padding: 0.05rem 0.45rem; border: 1px solid var(--c-333333); border-radius: 999px; }
.fr-badge--saved { color: var(--c-4ade80); }
.fr-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
</style>
