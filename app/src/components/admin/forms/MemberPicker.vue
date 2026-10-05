<script setup lang="ts">
/**
 * "Who played": a checkbox per band member, any number, plus a shortcut that
 * ticks everyone currently in the band. Links are explicit because line-ups
 * change — an empty list means nobody was linked, not "everyone".
 *
 * Shared by the concert and release forms.
 */
interface PickerMember {
  id: number
  first_name: string
  last_name: string
  is_current: boolean
}

const props = defineProps<{
  members: readonly PickerMember[]
  label: string
  /** data-testid of the block; the shortcut button gets `${testid}-current`. */
  testid: string
}>()

const selected = defineModel<number[]>({ required: true })

function toggle(id: number) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((m) => m !== id)
    : [...selected.value, id]
}

/** One click for the usual case: everyone currently in the band. */
function selectCurrentLineup() {
  selected.value = props.members.filter((m) => m.is_current).map((m) => m.id)
}
</script>

<template>
  <div v-if="members.length" :data-testid="testid">
    <div class="flex items-center justify-between gap-2">
      <label class="field-label">{{ label }}</label>
      <button type="button" class="btn-ghost text-xs" :data-testid="`${testid}-current`" @click="selectCurrentLineup">
        {{ $t('common.members.currentLineup') }}
      </button>
    </div>
    <div class="checkbox-list">
      <label v-for="m in members" :key="m.id" class="checkbox-item">
        <input type="checkbox" :checked="selected.includes(m.id)" @change="toggle(m.id)" />
        <span>{{ m.first_name }} {{ m.last_name }}</span>
      </label>
    </div>
  </div>
</template>
