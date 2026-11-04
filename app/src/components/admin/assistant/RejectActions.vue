<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Finding, SnoozeMonths } from '@/types/assistantCrawler'

/**
 * The two ways to say no to a new finding. "Not now" hides it for 1, 3 or 6
 * months and then it comes back on its own. "Wrong" hides it for good, and
 * can also block its whole site, channel or account so the crawler adds
 * nothing new from there. The block is opt-in per click because a finding's
 * site can be a whole outlet the band otherwise wants to hear from.
 */
defineProps<{ finding: Finding; busy: boolean }>()
const emit = defineEmits<{ snooze: [months: SnoozeMonths]; wrong: [blockSite: boolean] }>()

const MONTHS: SnoozeMonths[] = [1, 3, 6]

const root = ref<HTMLElement | null>(null)
const notNow = ref<HTMLDetailsElement | null>(null)
const wrong = ref<HTMLDetailsElement | null>(null)
const blockSite = ref(false)

// One popover at a time, and a click anywhere else closes it — two absolute
// panels at right: 0 would otherwise stack on top of each other.
function onToggle(which: 'notNow' | 'wrong') {
  const self = which === 'notNow' ? notNow.value : wrong.value
  const other = which === 'notNow' ? wrong.value : notNow.value
  if (self?.open && other) other.open = false
  // A box ticked and then left must not block a site on a later, plain "Wrong".
  if (which === 'wrong' && !self?.open) blockSite.value = false
}

function closeAll() {
  if (notNow.value) notNow.value.open = false
  if (wrong.value) wrong.value.open = false
}

function onDocumentClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) closeAll()
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

function snooze(months: SnoozeMonths) {
  closeAll()
  emit('snooze', months)
}

function confirmWrong() {
  const block = blockSite.value
  closeAll()
  emit('wrong', block)
}
</script>

<template>
  <div ref="root" class="ra-wrap">
    <details ref="notNow" class="ra" data-testid="not-now" @toggle="onToggle('notNow')">
      <summary class="btn-ghost" :aria-disabled="busy">{{ $t('more.assistant.notNow.button') }}</summary>
      <div class="ra-pop" role="menu">
        <p class="ra-heading">{{ $t('more.assistant.notNow.heading') }}</p>
        <button
          v-for="m in MONTHS"
          :key="m"
          type="button"
          role="menuitem"
          class="ra-item"
          :data-months="m"
          :disabled="busy"
          @click="snooze(m)"
        >
          <template v-if="m === 1">{{ $t('more.assistant.notNow.m1') }}</template>
          <template v-else-if="m === 3">{{ $t('more.assistant.notNow.m3') }}</template>
          <template v-else>{{ $t('more.assistant.notNow.m6') }}</template>
        </button>
      </div>
    </details>

    <details ref="wrong" class="ra" data-testid="wrong" @toggle="onToggle('wrong')">
      <summary class="btn-ghost" :aria-disabled="busy">{{ $t('more.assistant.wrong.button') }}</summary>
      <div class="ra-pop ra-pop--wide">
        <p class="ra-help">{{ $t('more.assistant.wrong.help') }}</p>
        <label v-if="finding.site" class="ra-check">
          <input v-model="blockSite" type="checkbox" data-testid="block-site" />
          <span>{{ $t('more.assistant.wrong.blockSite', { site: finding.site.label }) }}</span>
        </label>
        <p v-else class="ra-help ra-help--muted">{{ $t('more.assistant.wrong.noSite') }}</p>
        <button type="button" class="btn-primary ra-confirm" data-testid="confirm-wrong" :disabled="busy" @click="confirmWrong">
          {{ $t('more.assistant.wrong.confirm') }}
        </button>
      </div>
    </details>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.ra-wrap { display: flex; gap: 0.4rem; }
.ra { position: relative; }
.ra > summary { list-style: none; cursor: pointer; }
.ra > summary::-webkit-details-marker { display: none; }
.ra-pop {
  position: absolute; right: 0; z-index: 10; margin-top: 0.25rem; min-width: 11rem;
  display: flex; flex-direction: column; gap: 0.15rem; padding: 0.4rem;
  border: 1px solid var(--c-333333); border-radius: 0.5rem; background: var(--c-141414);
}
.ra-pop--wide { width: 18rem; gap: 0.6rem; padding: 0.75rem; }
.ra-heading { padding: 0.2rem 0.6rem; font-size: var(--fs-xs); color: var(--c-94a3b8); }
.ra-item {
  text-align: left; padding: 0.35rem 0.6rem; border: none; border-radius: 0.375rem;
  background: none; color: var(--c-e2e8f0); font-size: var(--fs-sm); cursor: pointer;
}
.ra-item:hover, .ra-item:focus-visible { background: var(--c-2a2a2a); }
.ra-help { font-size: var(--fs-sm); color: var(--c-e2e8f0); }
.ra-help--muted { font-size: var(--fs-xs); color: var(--c-94a3b8); }
.ra-check { display: flex; gap: 0.5rem; align-items: flex-start; font-size: var(--fs-sm); color: var(--c-e2e8f0); overflow-wrap: anywhere; }
.ra-check input { margin-top: 0.2rem; flex-shrink: 0; }
.ra-confirm { align-self: flex-end; }
</style>
