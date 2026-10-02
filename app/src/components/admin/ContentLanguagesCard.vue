<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentLocales } from '@/composables/useContentLocales'
import { nativeName, shortLabel, type Lang } from '@/locales'
import { moveLocale } from '@/utils/contentLocales'
import { reportSaveError } from '@/utils/formErrors'

const { t } = useI18n()
const { order, save } = useContentLocales()

// A local copy so a move shows at once; it is replaced by whatever the server
// stored, and put back if the save fails, so the list never claims an order
// that the forms are not actually using.
const draft = ref<Lang[]>([...order.value])
watch(order, (next) => { draft.value = [...next] })

function move(locale: Lang, step: -1 | 1): void {
  const previous = draft.value
  const next = moveLocale(previous, locale, step)
  if (next.every((l, i) => l === previous[i])) return

  draft.value = next
  save.mutate(next, {
    onError: (e) => {
      draft.value = previous
      reportSaveError(e, t('pages.modules.contentLanguages.saveFailed'))
    },
  })
}
</script>

<template>
  <section class="mb-6 rounded-xl border border-zinc-700 bg-zinc-900 p-4" data-testid="content-languages">
    <h2 class="text-sm font-semibold text-white">{{ $t('pages.modules.contentLanguages.title') }}</h2>
    <p class="mt-1 text-xs text-zinc-500">{{ $t('pages.modules.contentLanguages.lead') }}</p>

    <ol class="mt-3 flex flex-col gap-1.5">
      <li
        v-for="(l, i) in draft"
        :key="l"
        class="flex items-center gap-3 rounded-lg bg-zinc-800/60 px-3 py-2"
        :data-locale="l"
      >
        <span class="w-5 text-center text-xs font-mono text-zinc-500">{{ i + 1 }}</span>
        <span class="text-xs font-bold tracking-wider text-zinc-300">{{ shortLabel(l) }}</span>
        <span class="flex-1 text-sm text-white">{{ nativeName(l) }}</span>
        <span
          v-if="i === 0"
          class="rounded bg-teal-900/60 px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-teal-300"
        >{{ $t('pages.modules.contentLanguages.primary') }}</span>
        <button
          type="button"
          class="lang-move"
          :disabled="i === 0 || save.isPending.value"
          :aria-label="$t('pages.modules.contentLanguages.moveUp', { name: nativeName(l) })"
          @click="move(l, -1)"
          >↑</button> <!-- i18n-ignore: arrow glyph; the accessible name is the aria-label -->
        <button
          type="button"
          class="lang-move"
          :disabled="i === draft.length - 1 || save.isPending.value"
          :aria-label="$t('pages.modules.contentLanguages.moveDown', { name: nativeName(l) })"
          @click="move(l, 1)"
          >↓</button> <!-- i18n-ignore: arrow glyph; the accessible name is the aria-label -->
      </li>
    </ol>
  </section>
</template>

<style scoped>
.lang-move {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  color: var(--c-a1a1aa);
  background: transparent;
  cursor: pointer;
}
.lang-move:hover:not(:disabled) { color: var(--c-ffffff); background: var(--c-3f3f46); }
.lang-move:focus-visible { outline: 2px solid var(--c-14b8a6); outline-offset: 1px; }
.lang-move:disabled { opacity: 0.3; cursor: default; }
</style>
