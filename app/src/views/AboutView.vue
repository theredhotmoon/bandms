<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBandProfile } from '@/composables/useBandProfile'
import { useBandMembers } from '@/composables/useBandMembers'
import { useLang } from '@/composables/useLang'
import SiteNav from '@/components/public/SiteNav.vue'
import SiteFooter from '@/components/public/SiteFooter.vue'
import CheckerStrip from '@/components/public/CheckerStrip.vue'
import type { BandMember } from '@/types/bandMember'

const { lang } = useLang()
const { query: profileQ } = useBandProfile()
const { query: membersQ } = useBandMembers()

const profile = computed(() => profileQ.data.value)
const currentMembers = computed(() =>
  (membersQ.data.value ?? []).filter(m => m.is_current).sort((a, b) => a.sort_order - b.sort_order),
)
const formerMembers = computed(() =>
  (membersQ.data.value ?? []).filter(m => !m.is_current).sort((a, b) => a.sort_order - b.sort_order),
)

// Member modal
const modalMember = ref<BandMember | null>(null)
function openMember(m: BandMember) { modalMember.value = m }
function closeMember() { modalMember.value = null }

// Newsletter
const nlEmail = ref('')
const nlDone = ref(false)
function nlSubmit(e: Event) {
  e.preventDefault()
  if (nlEmail.value.includes('@')) nlDone.value = true
}

const T = {
  en: {
    heroTitle: 'About',
    heroSub: 'Skanking Storks — ska, ska-jazz and rocksteady from Warszawa.',
    bioTitle: 'The band',
    similarTitle: 'Sounds like',
    statsTitle: 'By the numbers',
    membersTitle: 'Meet the band',
    formerTitle: 'Alumni',
    pressTitle: 'Press & booking',
    pressDesc: 'For booking enquiries, press photos, EPK and tech rider — everything is ready to go.',
    bookBtn: 'Book us',
    epkBtn: 'Download EPK',
    riderBtn: 'Tech rider',
    photosBtn: 'Press photos',
    nlTitle: 'Stay in the loop',
    nlSub: 'Gigs, releases and news — straight to your inbox.',
    emailPh: 'your@email.com',
    subscribe: 'Subscribe →',
    close: 'Close',
    currentRole: 'Role',
    instruments: 'Instruments',
    monthly: 'Monthly listeners',
    followers: 'followers',
    subscribers: 'subscribers',
    instagram: 'Instagram',
    spotify: 'Spotify',
    youtube: 'YouTube',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    formation: 'Founded',
    hometown: 'Hometown',
  },
  pl: {
    heroTitle: 'O nas',
    heroSub: 'Skanking Storks — ska, ska-jazz i rocksteady z Warszawy.',
    bioTitle: 'Zespół',
    similarTitle: 'Brzmimy jak',
    statsTitle: 'W liczbach',
    membersTitle: 'Skład',
    formerTitle: 'Byli członkowie',
    pressTitle: 'Prasa i booking',
    pressDesc: 'Dla zapytań o booking, zdjęcia prasowe, EPK i rider techniczny — wszystko gotowe.',
    bookBtn: 'Zarezerwuj nas',
    epkBtn: 'Pobierz EPK',
    riderBtn: 'Rider techniczny',
    photosBtn: 'Zdjęcia prasowe',
    nlTitle: 'Bądź na bieżąco',
    nlSub: 'Koncerty, wydawnictwa i nowości — prosto na maila.',
    emailPh: 'twoj@email.com',
    subscribe: 'Zapisz się →',
    close: 'Zamknij',
    currentRole: 'Rola',
    instruments: 'Instrumenty',
    monthly: 'Miesięcznych słuchaczy',
    followers: 'obserwujących',
    subscribers: 'subskrybentów',
    instagram: 'Instagram',
    spotify: 'Spotify',
    youtube: 'YouTube',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    formation: 'Założony',
    hometown: 'Miasto',
  },
}
const t = computed(() => T[lang.value])

const bioText = computed(() =>
  profile.value?.bio_long ?? profile.value?.bio_medium ?? profile.value?.bio_short ?? '',
)

const comparableArtists = computed(() =>
  (profile.value?.comparable_artists ?? '').split(',').map(s => s.trim()).filter(Boolean),
)

interface Stat { label: string; value: string | number | null; unit: string }
const stats = computed((): Stat[] =>
  [
    { label: t.value.spotify,   value: profile.value?.stat_spotify_monthly     ?? null, unit: t.value.monthly },
    { label: t.value.instagram, value: profile.value?.stat_instagram_followers ?? null, unit: t.value.followers },
    { label: t.value.youtube,   value: profile.value?.stat_youtube_subscribers ?? null, unit: t.value.subscribers },
    { label: t.value.facebook,  value: profile.value?.stat_facebook_followers  ?? null, unit: t.value.followers },
    { label: t.value.tiktok,    value: profile.value?.stat_tiktok_followers    ?? null, unit: t.value.followers },
  ].filter(s => s.value !== null)
)

function formatStat(n: number | string | null): string {
  if (!n) return '—'
  const num = Number(n)
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K'
  return String(num)
}
</script>

<template>
  <div class="about-page">
    <SiteNav active="about" />
    <main>
    <!-- HERO -->
    <section class="hero">
      <div class="hero-checker" />
      <div class="hero-inner">
        <span class="hero-kicker">SKA · SKA-JAZZ · ROCKSTEADY</span>
        <h1 class="hero-title">{{ t.heroTitle }}</h1>
        <p class="hero-sub">{{ t.heroSub }}</p>
      </div>
    </section>

    <!-- BIO + SIMILAR ARTISTS -->
    <section class="bio-section">
      <div class="bio-inner">
        <div class="bio-col">
          <h2 class="section-head">{{ t.bioTitle }}</h2>
          <p class="bio-text">{{ bioText || 'Skanking Storks are a ska and rocksteady band from Warszawa, Poland.' }}</p>
          <div v-if="profile?.formation_year || profile?.hometown" class="meta-chips">
            <span v-if="profile?.formation_year" class="meta-chip">{{ t.formation }}: {{ profile.formation_year }}</span>
            <span v-if="profile?.hometown" class="meta-chip">{{ t.hometown }}: {{ profile.hometown }}</span>
          </div>
        </div>
        <div class="similar-col">
          <div class="similar-card">
            <h3 class="similar-title">{{ t.similarTitle }}</h3>
            <div v-if="comparableArtists.length" class="similar-list">
              <span v-for="a in comparableArtists" :key="a" class="similar-artist">{{ a }}</span>
            </div>
            <p v-else class="similar-empty">—</p>
            <div v-if="profile?.genres" class="genre-tags">
              <span v-for="g in (profile.genres.split(',').map(s => s.trim()).filter(Boolean))" :key="g" class="genre-tag">{{ g }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- STATS -->
    <section v-if="stats.length" class="stats-section">
      <div class="stats-inner">
        <div v-for="s in stats" :key="s.label" class="stat-cell">
          <div class="stat-num">{{ formatStat(s.value) }}</div>
          <div class="stat-label-main">{{ s.label }}</div>
          <div class="stat-unit">{{ s.unit }}</div>
        </div>
      </div>
    </section>

    <!-- MEMBERS -->
    <section class="members-section">
      <div class="members-inner">
        <h2 class="section-head">{{ t.membersTitle }}</h2>
        <CheckerStrip :h="12" :size="22" color-a="var(--color-accent)" color-b="#EFE7D6" style="margin: 20px 0 28px;" />

        <div v-if="currentMembers.length" class="members-grid">
          <div
            v-for="m in currentMembers"
            :key="m.id"
            class="member-card"
            @click="openMember(m)"
          >
            <div class="member-photo">
              <img v-if="m.photo" :src="m.photo" :alt="`${m.first_name} ${m.last_name}`" class="member-img" />
              <div v-else class="member-photo-placeholder">
                <span>{{ m.first_name[0] }}{{ m.last_name[0] }}</span>
              </div>
            </div>
            <div class="member-info">
              <div class="member-name">{{ m.first_name }} {{ m.last_name }}</div>
              <div class="member-role">{{ m.role }}</div>
            </div>
          </div>
        </div>

        <!-- Former members -->
        <div v-if="formerMembers.length" class="former-section">
          <h3 class="former-title">{{ t.formerTitle }}</h3>
          <div class="former-list">
            <span v-for="m in formerMembers" :key="m.id" class="former-chip">{{ m.first_name }} {{ m.last_name }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- PRESS & BOOKING -->
    <section class="press-section">
      <CheckerStrip :h="14" :size="28" color-a="#121212" color-b="#EFE7D6" />
      <div class="press-inner">
        <h2 class="section-head section-head--cream">{{ t.pressTitle }}</h2>
        <p class="press-sub">{{ t.pressDesc }}</p>
        <div class="press-grid">
          <RouterLink to="/contact" class="press-card press-card--accent">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>
            <span class="press-card-label">{{ t.bookBtn }}</span>
          </RouterLink>
          <RouterLink to="/epk" class="press-card">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            <span class="press-card-label">{{ t.epkBtn }}</span>
          </RouterLink>
          <RouterLink to="/tech-rider" class="press-card">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            <span class="press-card-label">{{ t.riderBtn }}</span>
          </RouterLink>
          <RouterLink to="/photos" class="press-card">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span class="press-card-label">{{ t.photosBtn }}</span>
          </RouterLink>
        </div>
      </div>
      <CheckerStrip :h="14" :size="18" color-a="var(--color-accent)" color-b="#121212" />
    </section>

    <!-- NEWSLETTER -->
    <section class="nl-section">
      <div class="nl-card">
        <div class="nl-text">
          <span class="nl-stamp">★ SKA</span>
          <h2 class="section-head">{{ t.nlTitle }}</h2>
          <p class="nl-sub">{{ t.nlSub }}</p>
        </div>
        <div v-if="nlDone" class="nl-done">
          ✦ {{ lang === 'en' ? "You're on the list!" : 'Jesteś na liście!' }}
        </div>
        <form v-else class="nl-form" @submit="nlSubmit">
          <input v-model="nlEmail" type="email" :placeholder="t.emailPh" class="nl-input" required />
          <button type="submit" class="nl-btn">{{ t.subscribe }}</button>
        </form>
      </div>
    </section>

    <!-- MEMBER MODAL -->
    <Teleport to="body">
      <div v-if="modalMember" class="modal-backdrop" @click.self="closeMember">
        <div class="member-modal" role="dialog" :aria-label="`${modalMember.first_name} ${modalMember.last_name}`">
          <button class="modal-close" :aria-label="t.close" @click="closeMember">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <div class="mm-inner">
            <div class="mm-photo">
              <img v-if="modalMember.photo" :src="modalMember.photo" :alt="`${modalMember.first_name} ${modalMember.last_name}`" class="mm-img" />
              <div v-else class="mm-photo-placeholder">{{ modalMember.first_name[0] }}{{ modalMember.last_name[0] }}</div>
            </div>
            <div class="mm-body">
              <h2 class="mm-name">{{ modalMember.first_name }} {{ modalMember.last_name }}</h2>
              <p class="mm-role">{{ modalMember.role }}</p>
              <p v-if="modalMember.bio" class="mm-bio">{{ modalMember.bio }}</p>
              <div v-if="modalMember.instruments?.length" class="mm-instruments">
                <span class="mm-instr-label">{{ t.instruments }}:</span>
                <span v-for="i in modalMember.instruments" :key="i.id" class="mm-instr-chip">{{ i.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.about-page { background: #EFE7D6; color: #121212; font-family: 'Archivo', sans-serif; }
.section-head { font: 400 56px/.86 'Anton', sans-serif; text-transform: uppercase; margin: 0; }
.section-head--cream { color: #EFE7D6; }

/* HERO */
.hero { background: #121212; color: #EFE7D6; position: relative; overflow: hidden; }
.hero-checker {
  position: absolute; inset: 0;
  background-image: repeating-conic-gradient(rgba(255,255,255,.04) 0% 25%, transparent 0% 50%);
  background-size: 36px 36px;
}
.hero-inner { position: relative; padding: 64px 90px; }
.hero-kicker { font: 800 13px/1 'Archivo', sans-serif; letter-spacing: .28em; color: var(--color-accent); text-transform: uppercase; display: block; margin-bottom: 16px; }
.hero-title { font: 400 80px/.85 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 18px; }
.hero-sub { font: 500 18px/1.5 'Archivo', sans-serif; color: rgba(239,231,214,.75); max-width: 520px; margin: 0; }

/* BIO */
.bio-section { padding: 56px 90px; }
.bio-inner { display: grid; grid-template-columns: 1fr 340px; gap: 56px; align-items: start; }
.bio-text { font: 500 20px/1.7 'Archivo', sans-serif; color: #2a2a2a; margin: 20px 0 0; }
.meta-chips { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; }
.meta-chip { border: 2px solid #121212; font: 700 13px/1 'Archivo', sans-serif; letter-spacing: .06em; padding: 8px 12px; border-radius: 3px; }
.similar-card {
  background: #121212; color: #EFE7D6;
  border: 3px solid #121212; box-shadow: 8px 8px 0 var(--color-accent);
  padding: 28px 24px;
}
.similar-title { font: 400 22px/1 'Anton', sans-serif; text-transform: uppercase; color: var(--color-accent); margin: 0 0 16px; }
.similar-list { display: flex; flex-direction: column; gap: 8px; }
.similar-artist { font: 600 17px/1.3 'Archivo', sans-serif; border-bottom: 1px solid rgba(239,231,214,.15); padding-bottom: 8px; }
.similar-empty { font: 500 15px/1 'Archivo', sans-serif; color: rgba(239,231,214,.4); margin: 0; }
.genre-tags { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 20px; }
.genre-tag { border: 2px solid var(--color-accent); color: var(--color-accent); font: 800 11px/1 'Archivo', sans-serif; letter-spacing: .1em; text-transform: uppercase; padding: 6px 10px; border-radius: 3px; }

/* STATS */
.stats-section { background: #121212; color: #EFE7D6; }
.stats-inner {
  display: flex; flex-wrap: wrap;
  padding: 40px 90px;
}
.stat-cell {
  flex: 1; min-width: 160px; padding: 32px 24px;
  border-right: 2px solid rgba(239,231,214,.15);
  text-align: center;
}
.stat-cell:last-child { border-right: none; }
.stat-num { font: 400 50px/.9 'Anton', sans-serif; color: var(--color-accent); }
.stat-label-main { font: 700 14px/1 'Archivo', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: rgba(239,231,214,.7); margin-top: 8px; }
.stat-unit { font: 600 12px/1 'Archivo', sans-serif; color: rgba(239,231,214,.4); margin-top: 5px; }

/* MEMBERS */
.members-section { padding: 56px 90px; }
.members-inner {}
.members-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.member-card {
  cursor: pointer; border: 3px solid #121212; box-shadow: 5px 5px 0 #121212;
  background: #fff; transition: box-shadow 180ms;
}
.member-card:hover { box-shadow: 8px 8px 0 var(--color-accent); }
.member-photo { aspect-ratio: 1; overflow: hidden; border-bottom: 3px solid #121212; background: #1a1a1a; display: grid; place-items: center; }
.member-img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
.member-photo-placeholder { font: 400 56px/1 'Anton', sans-serif; color: rgba(239,231,214,.3); }
.member-info { padding: 18px 20px 22px; }
.member-name { font: 400 26px/.95 'Anton', sans-serif; text-transform: uppercase; }
.member-role { font: 600 14px/1 'Archivo', sans-serif; color: var(--color-accent); margin-top: 7px; text-transform: uppercase; letter-spacing: .08em; }

.former-section { margin-top: 40px; }
.former-title { font: 400 28px/1 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 14px; color: #888; }
.former-list { display: flex; gap: 10px; flex-wrap: wrap; }
.former-chip { border: 2px solid #bbb; color: #777; font: 600 14px/1 'Archivo', sans-serif; padding: 8px 14px; border-radius: 3px; }

/* PRESS */
.press-section { background: #121212; color: #EFE7D6; }
.press-inner { padding: 56px 90px; }
.press-sub { font: 500 17px/1.5 'Archivo', sans-serif; color: rgba(239,231,214,.65); max-width: 520px; margin: 14px 0 28px; }
.press-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.press-card {
  background: transparent; border: 3px solid rgba(239,231,214,.25);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  padding: 36px 20px; text-decoration: none; color: #EFE7D6;
  transition: border-color 150ms, background 150ms;
}
.press-card:hover { border-color: var(--color-accent); background: rgba(226,112,42,.1); }
.press-card--accent { background: var(--color-accent); border-color: var(--color-accent); box-shadow: 5px 5px 0 rgba(239,231,214,.2); }
.press-card--accent:hover { opacity: .9; }
.press-card-label { font: 400 20px/1 'Anton', sans-serif; text-transform: uppercase; text-align: center; }

/* NEWSLETTER */
.nl-section { padding: 56px 90px; }
.nl-card { border: 4px dashed #121212; padding: 40px 48px; background: #fff; display: grid; grid-template-columns: 1fr 440px; gap: 40px; align-items: center; }
.nl-stamp { display: inline-block; border: 3px solid var(--color-accent); color: var(--color-accent); font: 800 12px/1 'Archivo', sans-serif; letter-spacing: .14em; text-transform: uppercase; padding: 7px 11px; transform: rotate(-4deg); border-radius: 3px; margin-bottom: 16px; }
.nl-sub { font: 500 16px/1.5 'Archivo', sans-serif; color: #444; margin: 10px 0 0; }
.nl-form { display: flex; flex-direction: column; gap: 12px; }
.nl-input { border: 3px solid #121212; padding: 15px 17px; font: 600 16px/1 'Archivo', sans-serif; background: #EFE7D6; color: #121212; outline: none; }
.nl-input:focus { outline: 3px solid var(--color-accent); outline-offset: -3px; }
.nl-btn { background: #121212; color: #EFE7D6; border: none; font: 400 18px/1 'Anton', sans-serif; text-transform: uppercase; padding: 16px 24px; cursor: pointer; box-shadow: 6px 6px 0 var(--color-accent); transition: opacity 150ms; }
.nl-btn:hover { opacity: .9; }
.nl-done { font: 400 28px/1.1 'Anton', sans-serif; color: var(--color-accent); text-transform: uppercase; }

/* MEMBER MODAL */
.modal-backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(18,18,18,.85); display: flex; align-items: center; justify-content: center; padding: 20px; }
.member-modal { background: #EFE7D6; border: 3px solid #121212; box-shadow: 12px 12px 0 var(--color-accent); max-width: 700px; width: 100%; position: relative; max-height: 90vh; overflow-y: auto; }
.modal-close { position: absolute; top: 14px; right: 16px; background: transparent; border: none; cursor: pointer; color: #121212; }
.modal-close:hover { color: var(--color-accent); }
.mm-inner { display: grid; grid-template-columns: 280px 1fr; }
.mm-photo { overflow: hidden; border-right: 3px solid #121212; background: #1a1a1a; display: grid; place-items: start; }
.mm-img { width: 100%; height: 100%; min-height: 340px; object-fit: cover; object-position: top; }
.mm-photo-placeholder { width: 100%; min-height: 340px; display: grid; place-items: center; font: 400 72px/1 'Anton', sans-serif; color: rgba(239,231,214,.3); }
.mm-body { padding: 32px 28px; }
.mm-name { font: 400 36px/.9 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 8px; }
.mm-role { font: 700 14px/1 'Archivo', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent); margin: 0 0 20px; }
.mm-bio { font: 500 16px/1.6 'Archivo', sans-serif; color: #2a2a2a; margin: 0 0 20px; }
.mm-instruments { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.mm-instr-label { font: 700 13px/1 'Archivo', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #666; flex-shrink: 0; }
.mm-instr-chip { border: 2px solid #121212; font: 600 13px/1 'Archivo', sans-serif; padding: 7px 11px; border-radius: 3px; }

@media (max-width: 1100px) {
  .hero-inner, .bio-section, .stats-inner, .members-section, .press-inner, .nl-section { padding-left: 40px; padding-right: 40px; }
  .stats-inner { padding: 36px 40px; }
}
@media (max-width: 900px) {
  .bio-inner { grid-template-columns: 1fr; }
  .press-grid { grid-template-columns: repeat(2, 1fr); }
  .mm-inner { grid-template-columns: 1fr; }
  .mm-photo { border-right: none; border-bottom: 3px solid #121212; }
  .mm-img { min-height: 200px; }
}
@media (max-width: 768px) {
  .hero-inner, .bio-section, .members-section, .press-inner, .nl-section { padding-left: 20px; padding-right: 20px; }
  .stats-inner { padding: 28px 20px; }
  .hero-title { font-size: 52px; }
  .members-grid { grid-template-columns: repeat(2, 1fr); }
  .nl-card { grid-template-columns: 1fr; padding: 28px 22px; }
}
@media (max-width: 480px) {
  .members-grid { grid-template-columns: 1fr; }
  .press-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
