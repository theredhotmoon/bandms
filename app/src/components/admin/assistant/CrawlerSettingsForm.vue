<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiLang } from '@/composables/useUiLang'
import type { CrawlerSettings, CrawlerSettingsResponse, SourceSettings } from '@/types/assistantCrawler'
import { countryName } from '@/utils/contactCodes'
import { parseList } from '@/utils/crawlerSettings'
import { sourceName } from '@/utils/crawlerSourceNames'

const props = defineProps<{ initial: CrawlerSettingsResponse; saving: boolean }>()
const emit = defineEmits<{ save: [settings: CrawlerSettings] }>()

const { t } = useI18n()
const { uiLang } = useUiLang()

// Lists are edited as text, one entry per line, and parsed on save.
const draft = reactive({
  keywords: '',
  rssFeeds: '',
  digestTo: '',
  countries: [] as string[],
  cities: {} as Record<string, string>,
  sources: {} as Record<string, SourceSettings>,
})

function load(r: CrawlerSettingsResponse): void {
  const s = r.data
  draft.keywords = s.keywords.join('\n')
  draft.rssFeeds = s.rss_feeds.join('\n')
  draft.digestTo = s.digest_to.join('\n')
  draft.countries = [...s.countries]
  draft.cities = Object.fromEntries(Object.entries(s.cities_by_country).map(([c, list]) => [c, list.join('\n')]))
  draft.sources = Object.fromEntries(Object.entries(s.sources).map(([k, v]) => [k, { ...v }]))
}
watch(() => props.initial, load, { immediate: true })

const countryOptions = computed(() =>
  props.initial.countries
    .map(c => ({ code: c.code, label: countryName(c.code, uiLang.value) ?? c.name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)

function submit(): void {
  emit('save', {
    ...props.initial.data,
    keywords: parseList(draft.keywords, { lines: true }),
    countries: draft.countries,
    cities_by_country: Object.fromEntries(draft.countries.map(c => [c, parseList(draft.cities[c] ?? '', { lines: true })])),
    sources: draft.sources,
    rss_feeds: parseList(draft.rssFeeds, { lines: true }),
    digest_to: parseList(draft.digestTo),
  })
}
</script>

<template>
  <form class="cs" data-testid="crawler-settings" @submit.prevent="submit">
    <section class="cs-section">
      <label class="field-label" for="cs-keywords">{{ $t('more.assistant.settings.keywords') }}</label>
      <textarea id="cs-keywords" v-model="draft.keywords" class="field-input" rows="3" />
      <p class="field-hint">{{ $t('more.assistant.settings.keywordsHelp') }}</p>
    </section>

    <section class="cs-section">
      <h2 class="section-title">{{ $t('more.assistant.settings.countries') }}</h2>
      <p class="field-hint">{{ $t('more.assistant.settings.countriesHelp') }}</p>
      <div class="cs-countries">
        <label v-for="c in countryOptions" :key="c.code" class="checkbox-item" :data-country="c.code">
          <input v-model="draft.countries" type="checkbox" :value="c.code" />
          {{ c.label }}
        </label>
      </div>
      <div v-for="code in draft.countries" :key="code" class="cs-cities">
        <label class="field-label" :for="`cs-cities-${code}`">
          {{ $t('more.assistant.settings.cities', { country: countryName(code, uiLang) ?? code }) }}
        </label>
        <textarea :id="`cs-cities-${code}`" v-model="draft.cities[code]" class="field-input" rows="2" />
      </div>
      <p v-if="draft.countries.length" class="field-hint">{{ $t('more.assistant.settings.citiesHelp') }}</p>
    </section>

    <section class="cs-section">
      <h2 class="section-title">{{ $t('more.assistant.settings.sources') }}</h2>
      <div v-for="src in initial.sources" :key="src.key" class="cs-source" :data-source="src.key">
        <label class="cs-source-name">
          <input v-model="draft.sources[src.key].enabled" type="checkbox" :disabled="!src.available" />
          {{ sourceName(src.key, t) }}
        </label>
        <span v-if="!src.available" class="cs-soon">{{ $t('more.assistant.settings.notYet') }}</span>
        <span v-else-if="!src.hasKey" class="cs-nokey">{{ $t('more.assistant.settings.noKey') }}</span>
        <label v-if="src.available" class="cs-cap">
          {{ $t('more.assistant.settings.capDay') }}
          <input v-model.number="draft.sources[src.key].cap_day" type="number" min="0" class="field-input cs-cap-input" />
        </label>
        <label v-if="src.available && draft.sources[src.key].cap_month !== undefined" class="cs-cap">
          {{ $t('more.assistant.settings.capMonth') }}
          <input v-model.number="draft.sources[src.key].cap_month" type="number" min="0" class="field-input cs-cap-input" />
        </label>
      </div>
    </section>

    <section class="cs-section">
      <label class="field-label" for="cs-rss">{{ $t('more.assistant.settings.rssFeeds') }}</label>
      <textarea id="cs-rss" v-model="draft.rssFeeds" class="field-input" rows="3" />
      <p class="field-hint">{{ $t('more.assistant.settings.rssFeedsHelp') }}</p>
    </section>

    <section class="cs-section">
      <label class="field-label" for="cs-digest">{{ $t('more.assistant.settings.digestTo') }}</label>
      <textarea id="cs-digest" v-model="draft.digestTo" class="field-input" rows="2" />
      <p class="field-hint">{{ $t('more.assistant.settings.digestToHelp') }}</p>
    </section>

    <div>
      <button type="submit" class="btn-primary" :disabled="saving">{{ $t('more.assistant.settings.save') }}</button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.cs { display: flex; flex-direction: column; gap: 1.5rem; max-width: 48rem; }
.cs-section { display: flex; flex-direction: column; gap: 0.4rem; }
.cs-countries { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.25rem 1rem; }
.cs-cities { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.5rem; }
.cs-source { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.25rem; padding: 0.4rem 0; }
.cs-source-name { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 12rem; color: var(--c-e2e8f0); font-size: var(--fs-sm); }
.cs-nokey { font-size: var(--fs-xs); color: var(--c-f59e0b); }
.cs-soon { font-size: var(--fs-xs); color: var(--c-94a3b8); }
.cs-cap { display: inline-flex; align-items: center; gap: 0.4rem; font-size: var(--fs-xs); color: var(--c-94a3b8); }
.cs-cap-input { width: 6rem; }
</style>
