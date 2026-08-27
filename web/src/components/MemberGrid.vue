<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

export interface GridMember {
  id: number
  name: string
  role: string
  bio: string | null
  photoUrl: string | null
  isCurrent: boolean
  instruments: readonly string[]
  socials: readonly { platform: string; url: string }[]
}

export interface MemberGridCopy {
  former: string
  plays: string
  close: string
  view: string
}

const props = defineProps<{ members: readonly GridMember[]; copy: MemberGridCopy }>()

const current = computed(() => props.members.filter((m) => m.isCurrent))
const former = computed(() => props.members.filter((m) => !m.isCurrent))

const open = ref<GridMember | null>(null)
const panel = ref<HTMLElement | null>(null)

function show(member: GridMember) {
  open.value = member
  document.body.style.overflow = 'hidden'
  void nextTick(() => panel.value?.focus())
}

function close() {
  open.value = null
  document.body.style.overflow = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

const SOCIAL_PATHS: Record<string, string> = {
  instagram: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  facebook: 'M14 8.5h2.2V5.4h-2.6c-2.3 0-3.6 1.4-3.6 3.7v1.7H8v3h2v6h3.1v-6h2.3l.4-3h-2.7V9.4c0-.6.3-.9 1-.9z',
  youtube: 'M11 9.5l4 2.5-4 2.5z',
  spotify: 'M8 10.4c2.6-.7 5.6-.4 7.8.9M8.4 13.2c2-.5 4.3-.3 6 .8M9 15.7c1.4-.4 2.9-.2 4.1.6',
  bandcamp: 'M8 14.5l2.4-5h5.6l-2.4 5z',
}

/**
 * Astro server-renders this island, and @astrojs/vue's renderToString discards
 * teleported content — leaving a hydration anchor with no target, which Vue then
 * fails to patch ("Cannot read properties of null"). Survivable while this is the
 * only teleporting island on its page; fatal the moment a second one lands. Same
 * gate as ModalShell.
 */
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <div>
    <!-- CURRENT LINE-UP -->
    <div class="mg-grid">
      <button v-for="member in current" :key="member.id" type="button" class="mg-card" @click="show(member)">
        <span class="mg-photo">
          <img v-if="member.photoUrl" :src="member.photoUrl" :alt="member.name" loading="lazy" />
          <span v-else class="mg-photo-fallback" aria-hidden="true" />
        </span>
        <span class="mg-body">
          <span v-if="member.role" class="mg-role">{{ member.role }}</span>
          <span class="mg-name">{{ member.name }}</span>
          <span v-if="member.instruments.length > 0" class="mg-chips">
            <span v-for="inst in member.instruments" :key="inst" class="mg-chip">{{ inst }}</span>
          </span>
        </span>
      </button>
    </div>

    <!-- FORMER MEMBERS -->
    <div v-if="former.length > 0" class="mg-former">
      <h3 class="mg-former-h">{{ copy.former }}</h3>
      <div class="mg-former-list">
        <button v-for="member in former" :key="member.id" type="button" class="mg-pill" @click="show(member)">
          <span class="mg-pill-photo">
            <img v-if="member.photoUrl" :src="member.photoUrl" :alt="member.name" loading="lazy" />
          </span>
          <span>
            <span class="mg-pill-name">{{ member.name }}</span>
            <span v-if="member.role" class="mg-pill-role">{{ member.role }}</span>
          </span>
        </button>
      </div>
    </div>

    <!-- MEMBER MODAL -->
    <Teleport v-if="mounted" to="body">
      <div
        v-if="open"
        class="mg-scrim"
        role="dialog"
        aria-modal="true"
        :aria-label="open.name"
        @click.self="close"
      >
        <div ref="panel" class="mg-panel" tabindex="-1">
          <div class="mg-panel-photo">
            <img v-if="open.photoUrl" :src="open.photoUrl" :alt="open.name" />
            <span v-else class="mg-photo-fallback" aria-hidden="true" />
          </div>

          <div class="mg-panel-body">
            <button type="button" class="mg-close" :aria-label="copy.close" @click="close">✕</button>

            <span v-if="open.role" class="mg-role">{{ open.role }}</span>
            <h3 class="mg-panel-name">{{ open.name }}</h3>

            <div v-if="open.instruments.length > 0" class="mg-plays">
              <span class="mg-plays-label">{{ copy.plays }}:</span>
              <span v-for="inst in open.instruments" :key="inst" class="mg-chip mg-chip--on">{{ inst }}</span>
            </div>

            <p v-if="open.bio" class="mg-bio">{{ open.bio }}</p>

            <div v-if="open.socials.length > 0" class="mg-socials">
              <a
                v-for="social in open.socials"
                :key="social.platform"
                class="mg-social"
                :href="social.url"
                target="_blank"
                rel="noopener"
                :aria-label="social.platform"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle v-if="social.platform === 'spotify' || social.platform === 'bandcamp'" cx="12" cy="12" r="9.2" />
                  <rect v-if="social.platform === 'instagram'" x="3" y="3" width="18" height="18" rx="5" />
                  <rect v-if="social.platform === 'youtube'" x="3" y="6" width="18" height="12" rx="3.5" />
                  <path :d="SOCIAL_PATHS[social.platform] ?? ''" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.mg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }

.mg-card {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  border: var(--border-width-card) solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-body);
}
.mg-card:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.mg-photo {
  position: relative;
  display: block;
  height: 260px;
  overflow: hidden;
  background: var(--color-inverse);
}
.mg-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }

.mg-photo-fallback {
  display: block;
  width: 100%;
  height: 100%;
  background-image: repeating-linear-gradient(
    45deg,
    color-mix(in oklab, var(--color-ink) 92%, white) 0 9px,
    color-mix(in oklab, var(--color-ink) 84%, white) 9px 18px
  );
}

.mg-body {
  display: block;
  padding: 16px 18px 18px;
  border-top: var(--border-width-card) solid var(--color-border);
}

.mg-role {
  display: block;
  font: 800 11px/1 var(--font-body);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.mg-name {
  display: block;
  margin: 8px 0 12px;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 26px;
  line-height: 1;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}

.mg-chips { display: flex; flex-wrap: wrap; gap: 7px; }

.mg-chip {
  border: 2px solid color-mix(in oklab, var(--color-ink) 25%, transparent);
  color: var(--color-muted);
  font: 800 11px/1 var(--font-body);
  letter-spacing: .08em;
  text-transform: uppercase;
  padding: 7px 10px;
  white-space: nowrap;
}
.mg-chip--on { border-color: var(--color-accent); color: var(--color-accent); }

/* ── Former members ───────────────────────────────────────────────────────── */
.mg-former { margin-top: 34px; }

.mg-former-h {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 1;
  color: var(--color-muted);
}

.mg-former-list { display: flex; flex-wrap: wrap; gap: 12px; }

.mg-pill {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  border: 2px solid color-mix(in oklab, var(--color-ink) 25%, transparent);
  padding: 10px 14px;
  color: var(--color-body);
}
.mg-pill:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.mg-pill-photo {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: var(--radius-pill);
  border: 2px solid var(--color-border);
  overflow: hidden;
  background: var(--color-inverse);
}
.mg-pill-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }

.mg-pill-name { display: block; font: 700 15px/1 var(--font-body); }
.mg-pill-role { display: block; margin-top: 3px; font: 600 12px/1 var(--font-body); color: var(--color-subtle); }

/* ── Modal ────────────────────────────────────────────────────────────────── */
.mg-scrim {
  position: fixed;
  inset: 0;
  z-index: 240;
  background: color-mix(in oklab, var(--color-ink) 86%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.mg-panel {
  width: 720px;
  max-width: 100%;
  max-height: 90vh;
  overflow: auto;
  background: var(--color-page);
  border: 5px solid var(--color-border);
  box-shadow: 14px 14px 0 var(--color-accent);
  display: grid;
  grid-template-columns: 260px 1fr;
  outline: none;
}

.mg-panel-photo {
  border-right: var(--border-width-emphasis) solid var(--color-border);
  background: var(--color-inverse);
  min-height: 100%;
  overflow: hidden;
}
.mg-panel-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }

.mg-panel-body { padding: 26px 28px 30px; position: relative; }

.mg-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-body);
  cursor: pointer;
}

.mg-panel-name {
  margin: 10px 0 16px;
  max-width: 85%;
  font-size: 40px;
  line-height: .95;
}

.mg-plays { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 18px; }
.mg-plays-label {
  align-self: center;
  font: 800 11px/1 var(--font-body);
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--color-subtle);
}

.mg-bio {
  margin: 0;
  font: 500 17px/1.6 var(--font-body);
  color: var(--color-body);
  text-wrap: pretty;
}

.mg-socials { display: flex; gap: 12px; margin-top: 22px; }
.mg-social {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 2px solid var(--color-border);
  color: var(--color-body);
}

@media (max-width: 1100px) {
  .mg-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 700px) {
  .mg-grid { grid-template-columns: 1fr; }
  .mg-panel { grid-template-columns: 1fr; }
  .mg-panel-photo { border-right: none; border-bottom: var(--border-width-emphasis) solid var(--color-border); height: 240px; min-height: 0; }
  .mg-panel-name { font-size: 30px; max-width: 100%; }
  .mg-scrim { padding: 12px; }
}
</style>
