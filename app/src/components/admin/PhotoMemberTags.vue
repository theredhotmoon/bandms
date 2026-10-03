<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Who is in a photo: a small button on the photo showing how many members are
 * tagged, opening a checkbox list of every member. Any number can be checked —
 * a photo often shows several of them. Each change is emitted at once with the
 * full set; the parent saves it.
 */
interface TagMember {
  id: number
  name: string
}

const props = defineProps<{
  memberIds: readonly number[]
  members: readonly TagMember[]
  saving?: boolean
}>()

const emit = defineEmits<{ change: [memberIds: number[]] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const pop = ref<HTMLElement | null>(null)
// The list is teleported to <body> and placed against the button: inside the
// photo card it would be clipped (the card hides its overflow) and cut off.
const popStyle = ref<Record<string, string>>({})

function toggleOpen() {
  open.value = !open.value
  if (!open.value || !root.value) return
  const r = root.value.getBoundingClientRect()
  popStyle.value = { top: `${r.top - 6}px`, left: `${Math.max(8, r.right)}px` }
}

const tagged = computed(() => props.members.filter((m) => props.memberIds.includes(m.id)))

function toggle(id: number, checked: boolean) {
  const next = checked ? [...props.memberIds, id] : props.memberIds.filter((m) => m !== id)
  emit('change', next)
}

// Close on a click anywhere else, and on Escape.
function onDocumentClick(event: MouseEvent) {
  const target = event.target as Node
  if (open.value && !root.value?.contains(target) && !pop.value?.contains(target)) open.value = false
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false // i18n-ignore: KeyboardEvent.key value
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="pmt" data-testid="photo-member-tags">
    <button
      type="button"
      class="pmt-toggle"
      :class="{ 'pmt-toggle--on': tagged.length > 0 }"
      :aria-expanded="open"
      :title="tagged.length ? tagged.map((m) => m.name).join(', ') : $t('media.photos.membersNone')"
      :aria-label="$t('media.photos.membersButton', { n: tagged.length })"
      @click.stop="toggleOpen"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5" /><path d="M17.5 13.5a5.5 5.5 0 0 1 3 5" />
      </svg>
      <span>{{ tagged.length }}</span>
    </button>

    <Teleport to="body">
    <div v-if="open" ref="pop" class="pmt-pop" :style="popStyle" role="group" :aria-label="$t('media.photos.membersTitle')" data-testid="photo-member-tags-list" @click.stop @mousedown.stop>
      <p class="pmt-title">{{ $t('media.photos.membersTitle') }}</p>
      <p v-if="!members.length" class="pmt-empty">{{ $t('media.photos.membersEmpty') }}</p>
      <label v-for="m in members" :key="m.id" class="pmt-option">
        <input
          type="checkbox"
          :checked="memberIds.includes(m.id)"
          :disabled="saving"
          @change="toggle(m.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ m.name }}</span>
      </label>
    </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pmt { position: relative; flex-shrink: 0; }
.pmt-toggle {
  display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.1rem 0.3rem; border-radius: 0.25rem;
  background: transparent; border: 1px solid var(--c-2a2a2a); color: var(--c-64748b);
  font-size: var(--fs-2xs); cursor: pointer;
}
.pmt-toggle--on { color: var(--c-e2e8f0); border-color: var(--c-475569-line); }
.pmt-pop {
  /* Fixed at the button's top-right corner (set in script), opening up-left. */
  position: fixed; transform: translate(-100%, -100%); z-index: 60; min-width: 12rem; max-height: 16rem; overflow-y: auto;
  padding: 0.5rem; border-radius: 0.5rem; background: var(--c-141414); border: 1px solid var(--c-2a2a2a);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
.pmt-title { margin: 0 0 0.35rem; font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-64748b); }
.pmt-empty { margin: 0; font-size: var(--fs-xs); color: var(--c-94a3b8); }
.pmt-option { display: flex; align-items: center; gap: 0.45rem; padding: 0.25rem 0.2rem; font-size: var(--fs-xs); color: var(--c-e2e8f0); cursor: pointer; }
</style>
