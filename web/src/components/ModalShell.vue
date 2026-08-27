<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'

/**
 * The 2-Tone dialog frame: ink header bar, paper panel, hard accent shadow.
 *
 * Only the chrome lives here. Opening, closing and Escape handling are
 * `useModalTrigger`, because a modal's triggers are static Astro markup outside
 * its island. Teleported to body so the panel is never trapped by an ancestor's
 * `overflow: hidden` or stacking context.
 *
 * Focus moves to the panel on open so keyboard users land inside the dialog
 * rather than continuing from wherever the trigger sat.
 *
 * The Teleport is gated on `mounted`, and that is load-bearing. Astro SSRs this
 * island, and a Teleport rendered on the server leaves a hydration anchor that
 * does not exist in the emitted HTML — Vue then throws
 * "Cannot read properties of null (reading 'insertBefore')" while patching it.
 * With one modal on the page that failure is survivable; with two, the second
 * teleport's anchor resolves to null, its component never finishes mounting, and
 * its document click listener is never attached, so the dialog simply never
 * opens. Rendering nothing until after mount keeps the teleport client-only.
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    closeLabel: string
    /** Panel width in px. The design uses 560 for the calendar, 640 for the EPK. */
    width?: number
  }>(),
  { width: 560 },
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) void nextTick(() => panel.value?.focus())
  },
)
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <div
      v-if="open"
      class="ms-scrim"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @click.self="emit('close')"
    >
      <div ref="panel" class="ms-panel" :style="`--panel-w:${width}px`" tabindex="-1">
        <div class="ms-head">
          <span class="ms-title">{{ title }}</span>
          <button type="button" class="ms-close" :aria-label="closeLabel" @click="emit('close')">
            ✕
          </button>
        </div>

        <div class="ms-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ms-scrim {
  position: fixed;
  inset: 0;
  z-index: 220;
  background: color-mix(in oklab, var(--color-ink) 76%, transparent);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
}

.ms-panel {
  width: var(--panel-w, 560px);
  max-width: 100%;
  max-height: 90vh;
  overflow: auto;
  background: var(--color-page);
  border: 5px solid var(--color-border);
  box-shadow: 14px 14px 0 var(--color-accent);
  outline: none;
}

.ms-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  padding: 16px 24px;
}

.ms-title {
  font: var(--display-weight) 26px/1 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}

.ms-close {
  width: 38px;
  height: 38px;
  flex: none;
  border: 2px solid var(--color-on-inverse);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-on-inverse);
  font-size: 16px;
  cursor: pointer;
}

.ms-body { padding: 22px 26px 26px; }

@media (max-width: 600px) {
  .ms-scrim { padding: 16px 10px; }
  .ms-title { font-size: 20px; }
  .ms-body { padding: 16px; }
}
</style>
