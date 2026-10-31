<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { saveErrorMessage } from '@/api/client'
import type { SetlistFmArtist } from '@/types/setlist'

/**
 * Bands like ours, picked from setlist.fm — the crawler reads where they
 * played. The search itself is the caller's (it holds the token); this only
 * shows results and keeps the chosen list.
 */
const props = defineProps<{ search: (q: string) => Promise<SetlistFmArtist[]> }>()
const model = defineModel<SetlistFmArtist[]>({ required: true })

const { t } = useI18n()
const query = ref('')
const results = ref<SetlistFmArtist[]>([])
const searching = ref(false)
const error = ref('')

async function run() {
  const q = query.value.trim()
  if (!q) return
  searching.value = true
  error.value = ''
  try {
    results.value = (await props.search(q)).filter(a => a.mbid && !model.value.some(b => b.mbid === a.mbid)).slice(0, 8)
  } catch (e) {
    error.value = saveErrorMessage(e, t('more.assistant.settings.siblingSearchFailed'))
  } finally {
    searching.value = false
  }
}

function add(a: SetlistFmArtist) {
  model.value = [...model.value, { mbid: a.mbid, name: a.name }]
  results.value = results.value.filter(r => r.mbid !== a.mbid)
}

function remove(mbid: string) {
  model.value = model.value.filter(b => b.mbid !== mbid)
}
</script>

<template>
  <div class="sb" data-testid="sibling-bands">
    <ul v-if="model.length" class="sb-chosen">
      <li v-for="b in model" :key="b.mbid" class="sb-chip" :data-mbid="b.mbid">
        {{ b.name }}
        <button type="button" class="sb-remove" :aria-label="$t('more.assistant.settings.siblingRemove', { name: b.name })" @click="remove(b.mbid)">×</button><!-- i18n-ignore: close glyph, label carries the text -->
      </li>
    </ul>
    <div class="sb-search">
      <input
        v-model="query"
        class="field-input"
        type="search"
        :placeholder="$t('more.assistant.settings.siblingSearch')"
        :aria-label="$t('more.assistant.settings.siblingSearch')"
        @keydown.enter.prevent="run"
      />
      <button type="button" class="btn-ghost" :disabled="searching" @click="run">{{ $t('more.assistant.settings.siblingFind') }}</button>
    </div>
    <p v-if="error" class="field-error">{{ error }}</p>
    <ul v-if="results.length" class="sb-results">
      <li v-for="a in results" :key="a.mbid">
        <button type="button" class="btn-ghost" @click="add(a)">+ {{ a.name }}</button><!-- i18n-ignore: add glyph before a band name -->
      </li>
    </ul>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.sb { display: flex; flex-direction: column; gap: 0.5rem; }
.sb-chosen, .sb-results { display: flex; flex-wrap: wrap; gap: 0.4rem; list-style: none; padding: 0; margin: 0; }
.sb-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.15rem 0.5rem; border: 1px solid var(--c-333333); border-radius: 999px;
  font-size: var(--fs-xs); color: var(--c-e2e8f0);
}
.sb-remove { background: none; border: none; color: var(--c-94a3b8); cursor: pointer; }
.sb-remove:hover { color: var(--c-e2e8f0); }
.sb-search { display: flex; gap: 0.5rem; max-width: 28rem; }
</style>
