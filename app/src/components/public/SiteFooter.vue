<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useLang } from '@/composables/useLang'
import CheckerStrip from './CheckerStrip.vue'

const { lang } = useLang()

const NAV = [
  { key: 'music',   to: '/releases',  en: 'Music',   pl: 'Muzyka' },
  { key: 'shows',   to: '/concerts',  en: 'Shows',   pl: 'Koncerty' },
  { key: 'gallery', to: '/photos',    en: 'Gallery', pl: 'Galeria' },
  { key: 'news',    to: '/posts',     en: 'News',    pl: 'Aktualności' },
  { key: 'shop',    to: '/merch',     en: 'Shop',    pl: 'Sklep' },
  { key: 'about',   to: '/about',     en: 'About',   pl: 'O nas' },
  { key: 'contact', to: '/contact',   en: 'Contact', pl: 'Kontakt' },
]

const SOCIALS = [
  { name: 'instagram', path: 'M3 3h18a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2z' },
  { name: 'facebook', path: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z' },
  { name: 'youtube', path: 'M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z' },
  { name: 'spotify', path: 'M12 2a10 10 0 100 20A10 10 0 0012 2zm4.56 14.44c-.18.29-.57.38-.86.2-2.35-1.44-5.31-1.76-8.8-.97-.33.08-.67-.12-.75-.46-.08-.33.13-.67.46-.75 3.82-.87 7.1-.5 9.75 1.12.29.17.38.57.2.86zm1.22-2.71c-.22.36-.7.47-1.06.25-2.7-1.66-6.8-2.14-9.99-1.17-.41.12-.85-.11-.97-.52-.13-.41.11-.84.52-.97 3.64-1.1 8.16-.56 11.24 1.35.36.22.47.7.26 1.06zm.1-2.82c-3.23-1.92-8.57-2.1-11.65-1.16-.5.15-1.02-.13-1.17-.62-.15-.5.13-1.02.62-1.17 3.54-1.08 9.44-.87 13.16 1.34.45.27.6.85.33 1.3-.27.45-.85.6-1.29.33z' },
  { name: 'bandcamp', path: 'M0 18l7.5-12h9L9 18z' },
]

const bookingText = {
  en: 'Festivals, clubs, private parties — let\'s make the room move.',
  pl: 'Festiwale, kluby, prywatne imprezy — rozruszamy każdą salę.',
}
const bookingTitle = { en: 'Booking & contact', pl: 'Booking i kontakt' }
const followTitle = { en: 'Follow', pl: 'Obserwuj' }
const rights = { en: 'All rights reserved.', pl: 'Wszelkie prawa zastrzeżone.' }
</script>

<template>
  <footer class="site-footer">
    <CheckerStrip :h="14" :size="28" color-a="var(--color-accent)" color-b="#EFE7D6" style="position:absolute;top:0;left:0;right:0;" />
    <div class="site-footer__grid">
      <div>
        <RouterLink to="/" class="site-footer__brand">SKANKING STORKS</RouterLink>
        <p class="site-footer__kicker">SKA · SKA-JAZZ · ROCKSTEADY</p>
        <div class="site-footer__socials">
          <a v-for="s in SOCIALS" :key="s.name" href="#" class="site-footer__social" :aria-label="s.name">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path :d="s.path" />
            </svg>
          </a>
        </div>
      </div>
      <div>
        <h3 class="site-footer__head">{{ bookingTitle[lang] }}</h3>
        <p class="site-footer__sub">{{ bookingText[lang] }}</p>
        <a href="mailto:booking@skankingstorks.com" class="site-footer__email">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>
          booking@skankingstorks.com
        </a>
      </div>
      <div>
        <h3 class="site-footer__head">{{ followTitle[lang] }}</h3>
        <nav class="site-footer__nav">
          <RouterLink v-for="item in NAV" :key="item.key" :to="item.to" class="site-footer__nav-link">
            {{ item[lang] }}
          </RouterLink>
        </nav>
      </div>
    </div>
    <div class="site-footer__bottom">
      <span>© 2026 SKANKING STORKS</span>
      <span>{{ rights[lang] }}</span>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  background: #121212;
  color: #EFE7D6;
  padding: 48px 90px 40px;
  position: relative;
}
.site-footer__grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 40px;
  border-bottom: 2px solid rgba(239,231,214,.2);
  padding-bottom: 32px;
  margin-top: 8px;
}
.site-footer__brand {
  font: 400 30px/1 'Anton', sans-serif;
  color: #EFE7D6;
  text-decoration: none;
  display: block;
}
.site-footer__kicker {
  font: 500 15px/1.5 'Archivo', sans-serif;
  color: rgba(239,231,214,.6);
  margin-top: 16px;
  max-width: 280px;
}
.site-footer__socials {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.site-footer__social {
  width: 42px; height: 42px;
  border: 2px solid #EFE7D6;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #EFE7D6;
  text-decoration: none;
  transition: opacity 120ms;
}
.site-footer__social:hover { opacity: .7; }
.site-footer__head {
  font: 400 26px/1 'Anton', sans-serif;
  text-transform: uppercase;
  margin-bottom: 14px;
  color: var(--color-accent);
}
.site-footer__sub {
  font: 500 15px/1.5 'Archivo', sans-serif;
  color: rgba(239,231,214,.75);
  margin-bottom: 12px;
}
.site-footer__email {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #EFE7D6;
  font: 700 16px/1 'Archivo', sans-serif;
  text-decoration: none;
}
.site-footer__nav {
  display: flex;
  flex-direction: column;
  gap: 9px;
  font: 700 15px/1 'Archivo', sans-serif;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.site-footer__nav-link {
  color: rgba(239,231,214,.8);
  text-decoration: none;
  transition: color 120ms;
}
.site-footer__nav-link:hover { color: var(--color-accent); }
.site-footer__bottom {
  display: flex;
  justify-content: space-between;
  padding-top: 18px;
  font: 600 13px/1 'Archivo', sans-serif;
  letter-spacing: .06em;
  color: rgba(239,231,214,.5);
}
@media (max-width: 900px) {
  .site-footer { padding: 40px 24px 32px; }
  .site-footer__grid { grid-template-columns: 1fr; gap: 28px; }
}
</style>
