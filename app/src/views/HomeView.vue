<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useBandProfile } from '@/composables/useBandProfile'
import { useConcerts } from '@/composables/useConcerts'
import { usePosts } from '@/composables/usePosts'
import { useReleases } from '@/composables/useReleases'
import { useMusicVideos } from '@/composables/useMusicVideos'
import { useLang } from '@/composables/useLang'
import SiteFooter from '@/components/public/SiteFooter.vue'
import CheckerStrip from '@/components/public/CheckerStrip.vue'
import LangToggle from '@/components/public/LangToggle.vue'
import { useAuth } from '@/composables/useAuth'

const { lang } = useLang()
const { isLoggedIn } = useAuth()
const { query: profileQ } = useBandProfile()
const { query: concertsQ } = useConcerts()
const postsFilters = ref({})
const { query: postsQ } = usePosts(postsFilters)
const { query: releasesQ } = useReleases()
const { query: videosQ } = useMusicVideos()

const profile = computed(() => profileQ.data.value)

const today = new Date()
today.setHours(0, 0, 0, 0)

const upcomingConcerts = computed(() =>
  (concertsQ.data.value ?? [])
    .filter(c => new Date(c.date + 'T00:00:00') >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3),
)

const recentPosts = computed(() =>
  (postsQ.data.value?.data ?? []).slice(0, 3),
)

const releases = computed(() => (releasesQ.data.value ?? []).slice(0, 3))
const videos = computed(() => (videosQ.data.value ?? []).slice(0, 3))

// Newsletter
const nlEmail = ref('')
const nlDone = ref(false)
function nlSubmit(e: Event) {
  e.preventDefault()
  if (nlEmail.value.includes('@')) nlDone.value = true
}

function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const T = {
  en: {
    kicker: 'SKA · SKA-JAZZ · ROCKSTEADY',
    tag: 'Brass-fuelled skank grooves\nand ska-jazz heat — straight off the upbeat!',
    listen: 'Listen now',
    upcomingShows: 'Upcoming shows',
    upcomingDesc: "We're hitting the road — dates below. Get on the list to hear first.",
    seeAll: 'See all shows',
    bookGig: 'Book a gig',
    aboutTitle: 'About the band',
    newsTitle: 'News',
    newsSub: 'Studio updates, fresh dates and stories from the road — our blog.',
    allPosts: 'All posts',
    readMore: 'Read more',
    listenWatch: 'Listen & watch',
    releasesHead: 'Latest releases',
    videosHead: 'Music videos',
    nlTitle: 'Never miss a skank',
    nlSub: 'Tour dates, new tunes and where to catch us live — straight to your inbox.',
    emailPh: 'your@email.com',
    subscribe: 'Join the list',
    tba: 'Date TBA',
    soon: 'Soon',
    views: 'views',
    emptyShows: 'Dates dropping soon — stay tuned.',
    comingSoon: 'Coming soon.',
    noPosts: 'No posts yet.',
    tickets: 'Tickets',
    admin: 'Admin',
  },
  pl: {
    kicker: 'SKA · SKA-JAZZ · ROCKSTEADY',
    tag: 'Dęciaki na full, rocksteady groove\ni ska-jazzowy żar — prosto z off-beatu.',
    listen: 'Posłuchaj',
    upcomingShows: 'Nadchodzące koncerty',
    upcomingDesc: 'Ruszamy w trasę — daty poniżej. Zapisz się, żeby wiedzieć pierwszy.',
    seeAll: 'Wszystkie koncerty',
    bookGig: 'Zarezerwuj termin',
    aboutTitle: 'O zespole',
    newsTitle: 'Aktualności',
    newsSub: 'Nowości ze studia, świeże daty i historie z trasy — nasz blog.',
    allPosts: 'Wszystkie wpisy',
    readMore: 'Czytaj więcej',
    listenWatch: 'Posłuchaj i obejrzyj',
    releasesHead: 'Najnowsze wydania',
    videosHead: 'Teledyski',
    nlTitle: 'Nie przegap żadnego skanku',
    nlSub: 'Daty tras, nowe kawałki i gdzie nas złapać na żywo — prosto na maila.',
    emailPh: 'twoj@email.com',
    subscribe: 'Dołącz do listy',
    tba: 'Data wkrótce',
    soon: 'Wkrótce',
    views: 'wyświetleń',
    emptyShows: 'Daty wkrótce — bądź w kontakcie.',
    comingSoon: 'Wkrótce.',
    noPosts: 'Brak wpisów.',
    tickets: 'Bilety',
    admin: 'Admin',
  },
}

const t = computed(() => T[lang.value])
const bioText = computed(() =>
  profile.value?.bio_medium ?? profile.value?.bio_short ?? 'Skanking Storks — ska, ska-jazz and rocksteady from Warszawa.',
)
</script>

<template>
  <div class="home-page">
    <!-- ── HERO ──────────────────────────────────── -->
    <section class="hero">
      <img
        v-if="profile?.logo_url"
        :src="profile.logo_url"
        alt=""
        class="hero-bg"
      />
      <div class="hero-overlay" />
      <div class="hero-checker" />

      <!-- Nav bar on top of hero -->
      <header class="hero-nav">
        <RouterLink to="/" class="hero-brand">SKANKING STORKS</RouterLink>
        <nav class="hero-nav-links">
          <RouterLink to="/releases" class="hero-nav-item">{{ lang === 'en' ? 'Music' : 'Muzyka' }}</RouterLink>
          <RouterLink to="/concerts" class="hero-nav-item">{{ lang === 'en' ? 'Shows' : 'Koncerty' }}</RouterLink>
          <RouterLink to="/photos" class="hero-nav-item">{{ lang === 'en' ? 'Gallery' : 'Galeria' }}</RouterLink>
          <RouterLink to="/posts" class="hero-nav-item">{{ lang === 'en' ? 'News' : 'Aktualności' }}</RouterLink>
          <RouterLink to="/merch" class="hero-nav-item">{{ lang === 'en' ? 'Shop' : 'Sklep' }}</RouterLink>
          <RouterLink to="/about" class="hero-nav-item">{{ lang === 'en' ? 'About' : 'O nas' }}</RouterLink>
          <RouterLink to="/contact" class="hero-nav-item">{{ lang === 'en' ? 'Contact' : 'Kontakt' }}</RouterLink>
          <LangToggle dark />
          <RouterLink v-if="isLoggedIn" to="/admin" class="hero-admin-btn">{{ t.admin }}</RouterLink>
        </nav>
      </header>

      <!-- Centered content -->
      <div class="hero-center">
        <span class="hero-kicker">{{ t.kicker }}</span>

        <div class="hero-logo-wrap">
          <img
            v-if="profile?.logo_url"
            :src="profile.logo_url"
            alt="Skanking Storks"
            class="hero-logo-img"
          />
          <span v-else class="hero-logo-placeholder">SS</span>
        </div>

        <p class="hero-tagline">{{ t.tag }}</p>

        <RouterLink to="/releases" class="hero-listen-btn">
          <span class="hero-play-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-accent)" stroke="none"><path d="M8 5.5l11 6.5-11 6.5z" /></svg>
          </span>
          {{ t.listen }}
        </RouterLink>

        <div class="hero-socials">
          <a href="#" class="hero-social" aria-label="instagram">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" stroke="none" /></svg>
          </a>
          <a href="#" class="hero-social" aria-label="facebook">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg>
          </a>
          <a href="#" class="hero-social" aria-label="youtube">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="3.5" /><path d="M11 9.5l4 2.5-4 2.5z" fill="currentColor" stroke="none" /></svg>
          </a>
          <a href="#" class="hero-social" aria-label="spotify">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2" /><path d="M8 10.4c2.6-.7 5.6-.4 7.8.9M8.4 13.2c2-.5 4.3-.3 6 .8M9 15.7c1.4-.4 2.9-.2 4.1.6" /></svg>
          </a>
        </div>
      </div>
    </section>

    <!-- ── MARQUEE ─────────────────────────────── -->
    <div class="marquee-bar" aria-hidden="true">
      <div class="marquee-track">
        <span v-for="i in 16" :key="i">SKA <span class="marquee-dot">✦</span> SKA-JAZZ <span class="marquee-dot">✦</span> ROCKSTEADY <span class="marquee-dot">✦</span>&nbsp;</span>
      </div>
    </div>

    <!-- ── SHOWS + ABOUT ──────────────────────── -->
    <section class="two-col-section">
      <!-- Shows column -->
      <div class="shows-col">
        <h2 class="section-head">{{ t.upcomingShows }}</h2>
        <p class="section-desc">{{ t.upcomingDesc }}</p>

        <div v-if="upcomingConcerts.length" class="shows-list">
          <div v-for="(c, i) in upcomingConcerts" :key="c.id" class="show-row">
            <span class="show-num">{{ String(i + 1).padStart(2, '0') }}</span>
            <div class="show-info">
              <div class="show-city">{{ c.venue.city || c.venue.name }}</div>
              <div class="show-meta">{{ c.venue.name }}&ensp;<span class="show-date">{{ formatDate(c.date) }}</span></div>
            </div>
            <a v-if="c.links?.length" :href="c.links[0].url" target="_blank" rel="noopener" class="show-ticket-btn">
              {{ t.tickets }}
            </a>
            <span v-else class="show-tba">{{ t.tba }}</span>
          </div>
        </div>
        <p v-else class="empty-text">{{ t.emptyShows }}</p>

        <div class="shows-actions">
          <RouterLink to="/concerts" class="ghost-btn">{{ t.seeAll }} <span class="act">→</span></RouterLink>
          <RouterLink to="/contact" class="solid-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>
            {{ t.bookGig }}
          </RouterLink>
        </div>
      </div>

      <!-- About column -->
      <div class="about-col">
        <h2 class="section-head">{{ t.aboutTitle }}</h2>
        <div class="genre-chips">
          <span v-for="g in ['SKA', 'SKA-JAZZ', 'BLUE BEAT', 'ROCKSTEADY']" :key="g" class="genre-chip">{{ g }}</span>
        </div>
        <p class="about-bio">{{ bioText }}</p>
      </div>
    </section>

    <!-- ── NEWS ──────────────────────────────── -->
    <section class="news-section">
      <CheckerStrip :h="14" :size="28" color-a="var(--color-accent)" color-b="#EFE7D6" />
      <div class="news-inner">
        <div class="news-hd">
          <div>
            <h2 class="section-head section-head--cream">{{ t.newsTitle }}</h2>
            <p class="news-sub">{{ t.newsSub }}</p>
          </div>
          <RouterLink to="/posts" class="news-all-link">{{ t.allPosts }} →</RouterLink>
        </div>

        <div v-if="recentPosts.length" class="news-grid">
          <!-- Featured post -->
          <article class="news-featured" tabindex="0" role="button" @click="$router.push(`/posts/${recentPosts[0].id}`)" @keydown.enter="$router.push(`/posts/${recentPosts[0].id}`)">
            <div class="news-feat-img">
              <div class="img-placeholder" />
              <span v-if="recentPosts[0].tags.length" class="post-tag">{{ recentPosts[0].tags[0].name }}</span>
            </div>
            <div class="news-feat-body">
              <span class="post-date">{{ formatDate(recentPosts[0].published_at ?? recentPosts[0].created_at) }}</span>
              <h3 class="news-feat-title">{{ recentPosts[0].title }}</h3>
              <p class="news-feat-excerpt">{{ recentPosts[0].excerpt }}</p>
              <span class="read-more-link">{{ t.readMore }} →</span>
            </div>
          </article>

          <!-- Side posts -->
          <div class="news-side">
            <article
              v-for="post in recentPosts.slice(1)"
              :key="post.id"
              class="news-side-card"
              tabindex="0"
              role="button"
              @click="$router.push(`/posts/${post.id}`)"
              @keydown.enter="$router.push(`/posts/${post.id}`)"
            >
              <div class="news-side-img" />
              <div class="news-side-body">
                <span class="post-tag-small">{{ post.tags[0]?.name ?? '' }} · {{ formatDate(post.published_at ?? post.created_at) }}</span>
                <h3 class="news-side-title">{{ post.title }}</h3>
                <p class="news-side-excerpt">{{ post.excerpt }}</p>
              </div>
            </article>
          </div>
        </div>
        <p v-else class="empty-text empty-text--cream">{{ t.noPosts }}</p>
      </div>
      <CheckerStrip :h="14" :size="18" color-a="#121212" color-b="#EFE7D6" />
    </section>

    <!-- ── LISTEN & WATCH ─────────────────────── -->
    <section class="listen-section">
      <div class="listen-inner">
        <div class="listen-hd">
          <h2 class="section-head">{{ t.listenWatch }}</h2>
          <RouterLink to="/releases" class="ghost-btn">{{ t.listen }} <span class="act">→</span></RouterLink>
        </div>

        <div class="listen-grid">
          <!-- Releases -->
          <div>
            <div class="col-hd-row">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-accent)" stroke="none"><path d="M8 5.5l11 6.5-11 6.5z" /></svg>
              <h3 class="col-hd">{{ t.releasesHead }}</h3>
            </div>
            <div v-if="releases.length" class="releases-list">
              <div v-for="r in releases" :key="r.id" class="release-row">
                <div class="release-cover">
                  <img v-if="r.cover_image" :src="r.cover_image" :alt="r.title" class="cover-img" />
                  <div v-else class="cover-placeholder" />
                </div>
                <div class="release-info">
                  <div class="release-title">{{ r.title }}</div>
                  <div class="release-meta">{{ r.type.toUpperCase() }} · {{ r.release_date?.slice(0, 4) ?? '—' }}</div>
                  <span v-if="r.is_upcoming" class="stamp-soon">{{ t.soon }}</span>
                  <div v-else class="release-links">
                    <a v-for="l in r.links?.slice(0, 2)" :key="l.id" :href="l.url" target="_blank" rel="noopener" class="platform-btn">{{ l.platform }}</a>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="empty-text">{{ t.comingSoon }}</p>
          </div>

          <!-- Videos -->
          <div>
            <div class="col-hd-row">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="3.5" /><path d="M11 9.5l4 2.5-4 2.5z" fill="var(--color-accent)" stroke="none" /></svg>
              <h3 class="col-hd">{{ t.videosHead }}</h3>
            </div>
            <div v-if="videos.length" class="videos-list">
              <a v-for="v in videos" :key="v.id" :href="v.video_url" target="_blank" rel="noopener" class="video-row">
                <div class="video-thumb">
                  <img v-if="v.og_image" :src="v.og_image" :alt="v.title" class="cover-img" />
                  <div v-else class="cover-placeholder" />
                  <div class="video-play-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M8 5.5l11 6.5-11 6.5z" /></svg>
                  </div>
                </div>
                <div class="video-info">
                  <div class="video-title">{{ v.title }}</div>
                  <div class="video-meta">@skankingstorks{{ v.view_count ? ' · ' + v.view_count + ' ' + t.views : '' }}</div>
                </div>
              </a>
            </div>
            <p v-else class="empty-text">{{ t.comingSoon }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── NEWSLETTER ─────────────────────────── -->
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
          <button type="submit" class="nl-submit">{{ t.subscribe }} →</button>
        </form>
      </div>
    </section>

    <SiteFooter />
  </div>
</template>

<style scoped>
/* ── Reset / shell ─────────────────────────────── */
.home-page {
  background: #EFE7D6;
  color: #121212;
  font-family: 'Archivo', sans-serif;
}

/* ── HERO ──────────────────────────────────────── */
.hero {
  position: relative;
  min-height: 840px;
  display: flex;
  flex-direction: column;
  color: #EFE7D6;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1) contrast(1.25) brightness(.6);
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: #121212;
  opacity: .56;
}
.hero-checker {
  position: absolute;
  inset: 0;
  background-image: repeating-conic-gradient(rgba(0,0,0,0) 0% 25%, rgba(255,255,255,.055) 0% 50%);
  background-size: 46px 46px;
}
/* nav on hero */
.hero-nav {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 90px;
  flex-wrap: wrap;
}
.hero-brand {
  font: 400 22px/1 'Anton', sans-serif;
  color: #EFE7D6;
  text-decoration: none;
  flex-shrink: 0;
}
.hero-nav-links {
  display: flex;
  align-items: center;
  gap: 22px;
  font: 700 14px/1 'Archivo', sans-serif;
  letter-spacing: .08em;
  text-transform: uppercase;
  flex-wrap: wrap;
}
.hero-nav-item {
  color: #EFE7D6;
  text-decoration: none;
  transition: opacity 120ms;
}
.hero-nav-item:hover { opacity: .7; }
.hero-admin-btn {
  color: var(--color-accent);
  text-decoration: none;
  border: 2px solid var(--color-accent);
  padding: 6px 12px;
  transition: background 120ms, color 120ms;
}
.hero-admin-btn:hover { background: var(--color-accent); color: #fff; }

/* center content */
.hero-center {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 60px 72px;
  justify-content: center;
}
.hero-kicker {
  font: 800 15px/1 'Archivo', sans-serif;
  letter-spacing: .36em;
  color: var(--color-accent);
  text-transform: uppercase;
  margin-bottom: 28px;
}
.hero-logo-wrap {
  width: 340px;
  height: 340px;
  border-radius: 50%;
  border: 16px solid var(--color-accent);
  overflow: hidden;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 20px 60px rgba(0,0,0,.55);
}
.hero-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.hero-logo-placeholder {
  font: 400 90px/1 'Anton', sans-serif;
  color: rgba(239,231,214,.35);
}
.hero-tagline {
  font: 500 23px/1.5 'Archivo', sans-serif;
  max-width: 600px;
  margin: 30px 0 36px;
  color: rgba(239,231,214,.92);
  white-space: pre-line;
}
.hero-listen-btn {
  display: inline-flex;
  align-items: center;
  gap: 18px;
  background: var(--color-accent);
  color: #fff;
  text-decoration: none;
  font: 400 36px/1 'Anton', sans-serif;
  text-transform: uppercase;
  padding: 20px 44px;
  box-shadow: 0 12px 36px rgba(0,0,0,.5);
  transition: opacity 150ms;
}
.hero-listen-btn:hover { opacity: .92; }
.hero-play-circle {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #fff;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.hero-socials {
  display: flex;
  gap: 18px;
  margin-top: 30px;
}
.hero-social {
  color: #EFE7D6;
  text-decoration: none;
  transition: color 120ms;
}
.hero-social:hover { color: var(--color-accent); }

/* ── MARQUEE ─────────────────────────────────── */
.marquee-bar {
  background: #121212;
  border-bottom: 4px solid var(--color-accent);
  height: 56px;
  overflow: hidden;
  display: flex;
  align-items: center;
}
.marquee-track {
  display: flex;
  white-space: nowrap;
  animation: scroll-left 22s linear infinite;
  font: 400 28px/2 'Anton', sans-serif;
  color: #EFE7D6;
}
@keyframes scroll-left {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.marquee-dot { color: var(--color-accent); }

/* ── SHARED UTILS ────────────────────────────── */
.section-head {
  font: 400 56px/.86 'Anton', sans-serif;
  text-transform: uppercase;
  margin: 0;
  color: #121212;
}
.section-head--cream { color: #EFE7D6; }
.section-desc {
  font: 500 16px/1.5 'Archivo', sans-serif;
  color: #444;
  margin: 14px 0 22px;
}
.empty-text {
  font: 500 15px/1.5 'Archivo', sans-serif;
  color: #777;
  padding: 20px 0;
}
.empty-text--cream { color: rgba(239,231,214,.5); }

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: 3px solid #121212;
  background: transparent;
  color: #121212;
  font: 400 16px/1 'Anton', sans-serif;
  text-transform: uppercase;
  padding: 13px 20px;
  text-decoration: none;
  transition: background 120ms, color 120ms;
  cursor: pointer;
}
.ghost-btn:hover { background: #121212; color: #EFE7D6; }
.act { color: var(--color-accent); }
.solid-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  font: 400 16px/1 'Anton', sans-serif;
  text-transform: uppercase;
  padding: 14px 20px;
  text-decoration: none;
  box-shadow: 5px 5px 0 #121212;
  cursor: pointer;
  transition: opacity 150ms;
}
.solid-btn:hover { opacity: .9; }

/* ── SHOWS + ABOUT ───────────────────────────── */
.two-col-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  padding: 60px 90px 52px;
}
.shows-list { border-top: 3px solid #121212; }
.show-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 22px;
  padding: 18px 4px;
  border-bottom: 3px solid #121212;
}
.show-num {
  font: 400 30px/1 'Anton', sans-serif;
  color: var(--color-accent);
}
.show-city {
  font: 400 28px/.95 'Anton', sans-serif;
  text-transform: uppercase;
}
.show-meta {
  font: 600 14px/1 'Archivo', sans-serif;
  color: #555;
  margin-top: 6px;
}
.show-date { color: #888; }
.show-ticket-btn {
  display: inline-block;
  background: var(--color-accent);
  color: #fff;
  font: 400 15px/1 'Anton', sans-serif;
  text-transform: uppercase;
  padding: 12px 16px;
  text-decoration: none;
  box-shadow: 4px 4px 0 #121212;
  white-space: nowrap;
  transition: opacity 150ms;
}
.show-ticket-btn:hover { opacity: .9; }
.show-tba {
  display: inline-block;
  border: 3px solid #121212;
  color: #121212;
  font: 800 12px/1 'Archivo', sans-serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 7px 11px;
  transform: rotate(2deg);
  border-radius: 3px;
  white-space: nowrap;
}
.shows-actions { display: flex; gap: 12px; margin-top: 22px; flex-wrap: wrap; }

.genre-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.genre-chip {
  border: 2px solid var(--color-accent);
  color: var(--color-accent);
  font: 800 12px/1 'Archivo', sans-serif;
  letter-spacing: .1em;
  padding: 8px 11px;
  border-radius: 3px;
  white-space: nowrap;
}
.about-bio {
  font: 500 20px/1.6 'Archivo', sans-serif;
  color: #2a2a2a;
  margin: 22px 0 0;
}

/* ── NEWS ────────────────────────────────────── */
.news-section { background: #121212; color: #EFE7D6; }
.news-inner { padding: 60px 90px; }
.news-hd {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.news-sub {
  font: 500 16px/1.5 'Archivo', sans-serif;
  color: rgba(239,231,214,.65);
  max-width: 520px;
  margin-top: 12px;
}
.news-all-link {
  font: 700 14px/1 'Archivo', sans-serif;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--color-accent);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}
.news-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 24px; }

.news-featured {
  background: #EFE7D6;
  color: #121212;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: opacity 150ms;
  border: 3px solid #EFE7D6;
}
.news-featured:hover { opacity: .95; }
.news-feat-img { position: relative; height: 300px; overflow: hidden; }
.img-placeholder {
  width: 100%; height: 100%;
  background: repeating-linear-gradient(45deg, #2a2a2a, #2a2a2a 9px, #252525 9px, #252525 18px);
}
.post-tag {
  position: absolute;
  top: 14px; left: 14px;
  background: var(--color-accent);
  color: #fff;
  font: 800 12px/1 'Archivo', sans-serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  padding: 7px 11px;
}
.news-feat-body { padding: 24px 26px 28px; }
.post-date {
  font: 700 12px/1 'Archivo', sans-serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #888;
}
.news-feat-title {
  font: 400 36px/.95 'Anton', sans-serif;
  text-transform: uppercase;
  margin: 12px 0;
}
.news-feat-excerpt {
  font: 500 16px/1.55 'Archivo', sans-serif;
  color: #444;
  margin: 0;
}
.read-more-link {
  display: inline-block;
  font: 800 13px/1 'Archivo', sans-serif;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin-top: 18px;
  cursor: pointer;
}

.news-side { display: flex; flex-direction: column; gap: 24px; }
.news-side-card {
  background: #EFE7D6;
  color: #121212;
  display: grid;
  grid-template-columns: 144px 1fr;
  cursor: pointer;
  transition: opacity 150ms;
  border: 3px solid #EFE7D6;
}
.news-side-card:hover { opacity: .95; }
.news-side-img {
  background: repeating-linear-gradient(45deg, #2a2a2a, #2a2a2a 9px, #252525 9px, #252525 18px);
  min-height: 120px;
}
.news-side-body { padding: 16px 18px; }
.post-tag-small {
  font: 700 11px/1 'Archivo', sans-serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--color-accent);
}
.news-side-title {
  font: 400 22px/.98 'Anton', sans-serif;
  text-transform: uppercase;
  margin: 8px 0;
}
.news-side-excerpt {
  font: 500 13px/1.45 'Archivo', sans-serif;
  color: #555;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── LISTEN & WATCH ──────────────────────────── */
.listen-section {}
.listen-inner { padding: 58px 90px; }
.listen-hd {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}
.listen-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 52px; }
.col-hd-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 3px solid #121212;
}
.col-hd {
  font: 400 30px/.95 'Anton', sans-serif;
  text-transform: uppercase;
  margin: 0;
}

.releases-list, .videos-list { display: flex; flex-direction: column; }
.release-row {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 16px;
  align-items: center;
  padding: 15px 0;
  border-bottom: 2px solid rgba(18,18,18,.12);
}
.release-cover {
  width: 92px; height: 92px;
  border: 2px solid #121212;
  overflow: hidden;
  background: #1a1a1a;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder {
  width: 100%; height: 100%;
  background: repeating-linear-gradient(45deg, #1e1e1e, #1e1e1e 9px, #252525 9px, #252525 18px);
}
.release-title { font: 400 26px/.95 'Anton', sans-serif; text-transform: uppercase; }
.release-meta { font: 600 13px/1 'Archivo', sans-serif; color: #555; margin: 6px 0 10px; }
.stamp-soon {
  display: inline-block;
  border: 3px solid var(--color-accent);
  color: var(--color-accent);
  font: 800 12px/1 'Archivo', sans-serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 7px 11px;
  transform: rotate(-4deg);
  border-radius: 3px;
}
.release-links { display: flex; gap: 8px; flex-wrap: wrap; }
.platform-btn {
  display: inline-block;
  background: #121212;
  color: #EFE7D6;
  font: 400 13px/1 'Anton', sans-serif;
  text-transform: uppercase;
  padding: 8px 12px;
  text-decoration: none;
  transition: opacity 120ms;
}
.platform-btn:hover { opacity: .8; }

.video-row {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 16px;
  align-items: center;
  text-decoration: none;
  color: #121212;
  padding: 15px 0;
  border-bottom: 2px solid rgba(18,18,18,.12);
  transition: opacity 150ms;
}
.video-row:hover { opacity: .85; }
.video-thumb {
  position: relative;
  height: 86px;
  border: 2px solid #121212;
  overflow: hidden;
  background: #1a1a1a;
}
.video-play-btn {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.video-play-btn > * {
  display: none;
}
/* show the play icon on hover via a pseudo element approach - easier as an overlay */
.video-play-btn::after {
  content: '';
  display: block;
  width: 38px; height: 38px;
  background: var(--color-accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M8 5.5l11 6.5-11 6.5z'/%3E%3C/svg%3E") center/22px no-repeat;
  border-radius: 50%;
  box-shadow: 3px 3px 0 #121212;
}
.video-title { font: 700 17px/1.25 'Archivo', sans-serif; }
.video-meta { font: 600 13px/1 'Archivo', sans-serif; color: #666; margin-top: 7px; }

/* ── NEWSLETTER ──────────────────────────────── */
.nl-section { padding: 56px 90px; }
.nl-card {
  border: 4px dashed #121212;
  padding: 40px 48px;
  background: #fff;
  display: grid;
  grid-template-columns: 1fr 460px;
  gap: 40px;
  align-items: center;
}
.nl-stamp {
  display: inline-block;
  border: 3px solid var(--color-accent);
  color: var(--color-accent);
  font: 800 12px/1 'Archivo', sans-serif;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 7px 11px;
  transform: rotate(-4deg);
  border-radius: 3px;
  margin-bottom: 16px;
}
.nl-sub {
  font: 500 16px/1.5 'Archivo', sans-serif;
  color: #444;
  margin: 10px 0 0;
}
.nl-form { display: flex; flex-direction: column; gap: 12px; }
.nl-input {
  border: 3px solid #121212;
  padding: 16px 18px;
  font: 600 16px/1 'Archivo', sans-serif;
  background: #EFE7D6;
  color: #121212;
  outline: none;
}
.nl-input:focus { outline: 3px solid var(--color-accent); outline-offset: -3px; }
.nl-submit {
  background: #121212;
  color: #EFE7D6;
  border: none;
  font: 400 19px/1 'Anton', sans-serif;
  text-transform: uppercase;
  padding: 16px 24px;
  cursor: pointer;
  box-shadow: 6px 6px 0 var(--color-accent);
  transition: opacity 150ms;
}
.nl-submit:hover { opacity: .9; }
.nl-done {
  font: 400 28px/1.1 'Anton', sans-serif;
  color: var(--color-accent);
  text-transform: uppercase;
}

/* ── RESPONSIVE ──────────────────────────────── */
@media (max-width: 1100px) {
  .hero-nav, .hero-center { padding-left: 40px; padding-right: 40px; }
  .two-col-section { padding: 40px 40px; gap: 36px; }
  .news-inner, .listen-inner, .nl-section { padding-left: 40px; padding-right: 40px; }
}
@media (max-width: 768px) {
  .hero-nav { padding: 16px 20px; }
  .hero-center { padding: 20px 20px 56px; }
  .hero-nav-links { display: none; }
  .hero-logo-wrap { width: 220px; height: 220px; border-width: 10px; }
  .hero-listen-btn { font-size: 24px; padding: 16px 28px; }
  .two-col-section { grid-template-columns: 1fr; padding: 32px 20px; }
  .news-inner, .listen-inner { padding: 32px 20px; }
  .news-grid { grid-template-columns: 1fr; }
  .news-side-card { grid-template-columns: 1fr; }
  .listen-grid { grid-template-columns: 1fr; gap: 32px; }
  .nl-section { padding: 32px 20px; }
  .nl-card { grid-template-columns: 1fr; padding: 28px 24px; }
}
</style>
