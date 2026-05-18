<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BandMember } from '@/types/bandMember'

const props = defineProps<{ members: BandMember[] }>()
defineEmits<{ close: [] }>()

// ── Popup state ──────────────────────────────────────────────────────
const hovered     = ref<BandMember | null>(null)
const mouseX      = ref(0)
const mouseY      = ref(0)
const popupRight  = ref(false)
const popupRightX = ref(0)

function onBarMouseMove(e: MouseEvent) {
  mouseX.value     = e.clientX
  mouseY.value     = e.clientY
  popupRight.value = e.clientX < window.innerWidth / 2
  popupRightX.value = window.innerWidth - e.clientX + 16
}
function onBarEnter(m: BandMember, e: MouseEvent) {
  hovered.value = m
  onBarMouseMove(e)
}
function onBarLeave() { hovered.value = null }

// ── Timeline maths ───────────────────────────────────────────────────
const now = new Date().getFullYear()

const sorted = computed(() =>
  [...props.members].sort((a, b) => {
    const ay = a.joined_at ? +a.joined_at.slice(0, 4) : now
    const by = b.joined_at ? +b.joined_at.slice(0, 4) : now
    return ay - by
  })
)

const minYear = computed(() => {
  const years = props.members.filter(m => m.joined_at).map(m => +m.joined_at!.slice(0, 4))
  return years.length ? Math.min(...years) - 1 : now - 10
})
const maxYear = computed(() => now + 1)
const span    = computed(() => maxYear.value - minYear.value)

function left(m: BandMember): number {
  const y = m.joined_at ? +m.joined_at.slice(0, 4) : minYear.value
  return (y - minYear.value) / span.value * 100
}
function width(m: BandMember): number {
  const s = m.joined_at ? +m.joined_at.slice(0, 4) : minYear.value
  const e = m.quit_at   ? +m.quit_at.slice(0, 4)   : now + 1
  return Math.max((e - s) / span.value * 100, 0.5)
}

const ticks = computed(() => {
  const step = span.value > 20 ? 5 : span.value > 10 ? 2 : 1
  const out: number[] = []
  // align to step boundary
  const start = Math.ceil(minYear.value / step) * step
  for (let y = start; y <= maxYear.value; y += step) out.push(y)
  return out
})

function tickLeft(y: number): number {
  return (y - minYear.value) / span.value * 100
}

// ── Helpers ──────────────────────────────────────────────────────────
function initials(m: BandMember): string {
  return (m.first_name[0] + m.last_name[0]).toUpperCase()
}
function tenure(m: BandMember): string {
  const s = m.joined_at ? m.joined_at.slice(0, 4) : '?'
  const e = m.quit_at   ? m.quit_at.slice(0, 4)   : 'present'
  return `${s} – ${e}`
}
</script>

<template>
  <!-- Modal backdrop -->
  <Teleport to="body">
    <div class="tl-backdrop" @click.self="$emit('close')">
      <div class="tl-modal">

        <!-- Header -->
        <div class="tl-header">
          <span class="tl-title">Band Members Timeline</span>
          <button class="tl-close" @click="$emit('close')" aria-label="Close">✕</button>
        </div>

        <!-- Legend -->
        <div class="tl-legend">
          <span class="leg-dot current" />Current member
          <span class="leg-dot former" />Former member
        </div>

        <!-- Scrollable timeline body -->
        <div class="tl-body">
          <!-- Year ruler -->
          <div class="tl-ruler">
            <div class="ruler-track">
              <div
                v-for="y in ticks"
                :key="y"
                class="ruler-tick"
                :style="`left: ${tickLeft(y)}%`"
              >
                <span class="tick-label">{{ y }}</span>
              </div>
            </div>
          </div>

          <!-- Member rows -->
          <div class="tl-rows">
            <div v-for="m in sorted" :key="m.id" class="tl-row">
              <!-- Name label -->
              <div class="row-label" :class="{ former: !m.is_current }">
                <span class="label-name">{{ m.first_name }} {{ m.last_name }}</span>
                <span v-if="m.role" class="label-role">{{ m.role }}</span>
              </div>

              <!-- Track with bar -->
              <div class="row-track">
                <div
                  class="member-bar"
                  :class="m.is_current ? 'bar-current' : 'bar-former'"
                  :style="`left: ${left(m)}%; width: ${width(m)}%;`"
                  @mouseenter="onBarEnter(m, $event)"
                  @mousemove="onBarMouseMove"
                  @mouseleave="onBarLeave"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Hover popup (fixed, follows mouse) -->
        <Teleport to="body">
          <Transition name="popup">
            <div
              v-if="hovered"
              class="tl-popup"
              :style="{
                top:   `${mouseY}px`,
                left:  popupRight ? `${mouseX + 16}px` : 'auto',
                right: popupRight ? 'auto' : `${popupRightX}px`,
                transform: 'translateY(-50%)',
              }"
            >
              <div class="popup-top">
                <div v-if="hovered.photo" class="popup-photo">
                  <img :src="hovered.photo" :alt="`${hovered.first_name} ${hovered.last_name}`" />
                </div>
                <div v-else class="popup-initials">{{ initials(hovered) }}</div>
                <div class="popup-identity">
                  <div class="popup-name">{{ hovered.first_name }} {{ hovered.last_name }}</div>
                  <div v-if="hovered.role" class="popup-role">{{ hovered.role }}</div>
                  <div class="popup-tenure">{{ tenure(hovered) }}</div>
                </div>
              </div>
              <div v-if="hovered.instruments?.length" class="popup-instruments">
                <span v-for="i in hovered.instruments" :key="i.id" class="instr-tag">{{ i.name }}</span>
              </div>
              <p v-if="hovered.bio" class="popup-bio">{{ hovered.bio.slice(0, 200) }}{{ hovered.bio.length > 200 ? '…' : '' }}</p>
            </div>
          </Transition>
        </Teleport>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop / Modal ────────────────────────────────────────────── */
.tl-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}

.tl-modal {
  background: #ffffff;
  border: 1px solid #ddd;
  border-radius: 1rem;
  width: 100%;
  max-width: 960px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────────────────────────── */
.tl-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.tl-title {
  font-size: 0.9375rem; font-weight: 700; color: #111827;
}

.tl-close {
  background: none; border: none; color: #6b7280;
  font-size: 1rem; cursor: pointer; padding: 0.25rem 0.5rem;
  border-radius: 0.375rem; transition: color 150ms, background 150ms;
  line-height: 1;
}
.tl-close:hover { color: #ef4444; background: #fef2f2; }

/* ── Legend ─────────────────────────────────────────────────────── */
.tl-legend {
  display: flex; align-items: center; gap: 1.25rem;
  padding: 0.5rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.75rem; color: #6b7280;
  flex-shrink: 0;
}
.leg-dot {
  display: inline-block; width: 10px; height: 10px;
  border-radius: 2px; margin-right: 0.3rem;
}
.leg-dot.current { background: #374151; }
.leg-dot.former  { background: #d1d5db; }

/* ── Body ────────────────────────────────────────────────────────── */
.tl-body {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  padding: 1rem 1.25rem 1.5rem;
}

/* ── Ruler ───────────────────────────────────────────────────────── */
.tl-ruler {
  padding-left: 160px; /* same as row-label width */
  margin-bottom: 0.5rem;
}
.ruler-track {
  position: relative;
  height: 20px;
}
.ruler-tick {
  position: absolute;
  transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center;
}
.tick-label {
  font-size: 0.65rem; color: #9ca3af; white-space: nowrap;
}

/* ── Rows ────────────────────────────────────────────────────────── */
.tl-rows { display: flex; flex-direction: column; gap: 6px; }

.tl-row {
  display: flex; align-items: center; gap: 0.75rem; min-height: 28px;
}

.row-label {
  width: 160px; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: flex-end;
  padding-right: 0.5rem;
}
.row-label.former .label-name { opacity: 0.4; }

.label-name { font-size: 0.8125rem; font-weight: 600; color: #111827; white-space: nowrap; }
.label-role { font-size: 0.65rem; color: #6b7280; white-space: nowrap; }

.row-track {
  flex: 1;
  position: relative;
  height: 20px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: visible;
}

.member-bar {
  position: absolute;
  top: 0; bottom: 0;
  border-radius: 4px;
  cursor: pointer;
  transition: filter 150ms;
  min-width: 4px;
}
.member-bar:hover { filter: brightness(0.85); }

.bar-current {
  background: #374151;
}
.bar-former {
  background: #d1d5db;
  border: 1px solid #9ca3af;
}
</style>

<!-- Popup styles are unscoped so the Teleport'ed element can use them -->
<style>
.tl-popup {
  position: fixed;
  z-index: 200;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 0.875rem;
  width: 260px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  pointer-events: none;
}

.popup-top {
  display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.625rem;
}
.popup-photo {
  width: 44px; height: 44px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
  border: 2px solid #e5e7eb;
}
.popup-photo img { width: 100%; height: 100%; object-fit: cover; }
.popup-initials {
  width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
  background: #f3f4f6; border: 2px solid #e5e7eb;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.9375rem; font-weight: 700; color: #374151;
}
.popup-identity { min-width: 0; }
.popup-name    { font-size: 0.875rem; font-weight: 700; color: #111827; }
.popup-role    { font-size: 0.75rem; color: #6b7280; margin-top: 1px; }
.popup-tenure  { font-size: 0.7rem; color: #9ca3af; margin-top: 2px; }

.popup-instruments {
  display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 0.5rem;
}
.instr-tag {
  font-size: 0.65rem; padding: 0.15rem 0.5rem; border-radius: 0.25rem;
  background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb;
}

.popup-bio {
  font-size: 0.75rem; color: #6b7280; line-height: 1.5; margin: 0;
}

/* Popup transition */
.popup-enter-active, .popup-leave-active { transition: opacity 100ms, transform 100ms; }
.popup-enter-from, .popup-leave-to { opacity: 0; transform: translateY(-50%) scale(0.96); }
</style>
