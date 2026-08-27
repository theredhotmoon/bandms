<script setup lang="ts">
import { ref } from 'vue'

interface NavLink { href: string; label: string }

const props = defineProps<{ links: NavLink[] }>()
const open = ref(false)

function toggle() { open.value = !open.value }
function close()  { open.value = false }
</script>

<template>
  <div class="mob-nav">
    <button
      type="button"
      class="mob-toggle"
      :aria-label="open ? 'Close menu' : 'Open menu'"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg v-if="!open" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <Transition name="mob-fade">
      <div
        v-if="open"
        class="mob-overlay"
        @click.self="close"
      >
        <div class="mob-panel">
          <div class="mob-top">
            <span class="mob-brand">Skanking Storks</span>
            <button type="button" class="mob-close" aria-label="Close menu" @click="close">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <nav class="mob-links" aria-label="Mobile navigation">
            <a
              v-for="link in props.links"
              :key="link.href"
              :href="link.href"
              class="mob-link"
              @click="close"
            >
              {{ link.label }}
            </a>
          </nav>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mob-nav { display: block; }
@media (min-width: 1024px) { .mob-nav { display: none; } }

.mob-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: transparent;
  border: 2px solid color-mix(in oklab, var(--color-on-inverse) 45%, transparent);
  color: var(--color-page);
  cursor: pointer;
  transition: border-color .12s, background .12s;
}
.mob-toggle:hover { border-color: var(--color-page); background: color-mix(in oklab, var(--color-on-inverse) 8%, transparent); }

.mob-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: color-mix(in oklab, var(--color-ink) 50%, transparent);
  display: flex;
}
.mob-panel {
  width: min(380px, 90vw);
  background: var(--color-page);
  border-right: 3px solid var(--color-ink);
  box-shadow: 6px 0 0 var(--color-ink);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.mob-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 3px solid var(--color-ink);
  flex-shrink: 0;
}
.mob-brand {
  font-family: var(--font-display);
  font-size: 17px;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--color-ink);
}
.mob-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: transparent;
  border: 2px solid var(--color-ink);
  color: var(--color-ink);
  cursor: pointer;
  transition: background .12s, color .12s;
}
.mob-close:hover { background: var(--color-ink); color: var(--color-page); }

.mob-links {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.mob-link {
  font-family: var(--font-display);
  font-size: 30px;
  letter-spacing: .01em;
  text-transform: uppercase;
  color: var(--color-ink);
  text-decoration: none;
  padding: 14px 22px;
  border-bottom: 2px solid color-mix(in oklab, var(--color-ink) 12%, transparent);
  transition: background .12s, color .12s, padding-left .12s;
  display: block;
}
.mob-link:last-child { border-bottom: none; }
.mob-link:hover { background: var(--color-ink); color: var(--color-page); padding-left: 30px; }

.mob-fade-enter-active,
.mob-fade-leave-active { transition: opacity 0.18s ease; }
.mob-fade-enter-from,
.mob-fade-leave-to     { opacity: 0; }
</style>
