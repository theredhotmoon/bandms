<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiLang } from '@/composables/useUiLang'
import type { FindingKind, FindingsFilter } from '@/types/assistantCrawler'
import { countryName } from '@/utils/contactCodes'
import { countryChips, kindTabs } from '@/utils/findingsFilters'

const props = defineProps<{
  filter: FindingsFilter
  countries: Record<string, number>
  kinds: Partial<Record<FindingKind, number>>
}>()

const emit = defineEmits<{ change: [next: Partial<FindingsFilter>] }>()

const { t } = useI18n()
const { uiLang } = useUiLang()

const tabs = computed(() => kindTabs(props.kinds))
const chips = computed(() => countryChips(props.countries, props.filter.country))

// Explicit branches rather than a computed key, so the key guard can resolve each one.
function kindLabel(kind: FindingKind | null): string {
  switch (kind) {
    case 'lead':    return t('more.assistant.kinds.lead')
    case 'mention': return t('more.assistant.kinds.mention')
    case 'news':    return t('more.assistant.kinds.news')
    default:        return t('more.assistant.kinds.all')
  }
}
</script>

<template>
  <div class="ff" data-testid="findings-filters">
    <div class="ff-row">
      <div class="segment" role="radiogroup" :aria-label="$t('more.assistant.title')">
        <label v-for="tab in tabs" :key="tab.kind ?? 'all'" class="segment-option">
          <input
            type="radio"
            name="finding-kind"
            :checked="filter.kind === tab.kind"
            @change="emit('change', { kind: tab.kind })"
          />
          <span>{{ kindLabel(tab.kind) }} <span class="ff-count">{{ tab.count }}</span></span>
        </label>
      </div>

      <input
        class="field-input ff-search"
        type="search"
        :value="filter.q"
        :placeholder="$t('more.assistant.search')"
        :aria-label="$t('more.assistant.search')"
        @change="emit('change', { q: ($event.target as HTMLInputElement).value })"
      />

      <label class="ff-dismissed">
        <input
          type="checkbox"
          :checked="filter.status === 'dismissed'"
          @change="emit('change', { status: ($event.target as HTMLInputElement).checked ? 'dismissed' : 'new' })"
        />
        {{ $t('more.assistant.showDismissed') }}
      </label>
    </div>

    <div v-if="chips.length" class="ff-chips" role="group" :aria-label="$t('more.assistant.allCountries')">
      <button
        v-for="chip in chips"
        :key="chip.code"
        type="button"
        class="ff-chip"
        :class="{ 'ff-chip--on': filter.country === chip.code }"
        :aria-pressed="filter.country === chip.code"
        :data-country="chip.code"
        @click="emit('change', { country: chip.code })"
      >
        {{ countryName(chip.code, uiLang) }} <span class="ff-count">{{ chip.count }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.ff { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
.ff-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.ff-search { max-width: 16rem; }
.ff-dismissed { display: inline-flex; align-items: center; gap: 0.4rem; font-size: var(--fs-sm); color: var(--c-94a3b8); }
.ff-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.ff-chip {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--c-333333);
  border-radius: 999px;
  background: var(--c-141414);
  color: var(--c-94a3b8);
  font-size: var(--fs-xs);
  cursor: pointer;
}
.ff-chip:hover { color: var(--c-e2e8f0); }
.ff-chip--on { background: var(--c-2a2a2a); color: var(--c-ffffff); }
.ff-chip:focus-visible { outline: 2px solid var(--c-e2e8f0); outline-offset: 1px; }
.ff-count { opacity: 0.7; font-variant-numeric: tabular-nums; }
</style>
