<script setup lang="ts">
/**
 * The "Show more" button under a paged list island — see useShowMore().
 * Styled by the global .show-more classes, shared with ShowMore.astro.
 */
import { nextTick } from 'vue'
import { focusFirstRevealed, heldBack } from '@/lib/showMoreDom'

const props = defineProps<{
  label: string
  /** id of the list element whose items carry data-more-hidden. */
  list: string
}>()
const emit = defineEmits<{ click: [] }>()

// The island reveals the batch; this moves focus onto it, because on the last
// batch the island unmounts this button and focus would drop to <body>.
async function reveal() {
  const before = heldBack(props.list)
  emit('click')
  await nextTick()
  focusFirstRevealed(before)
}
</script>

<template>
  <div class="show-more">
    <button type="button" class="show-more-btn" data-testid="show-more" :aria-controls="list" @click="reveal">
      {{ label }}
    </button>
  </div>
</template>
