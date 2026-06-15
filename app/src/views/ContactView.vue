<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useBandProfile } from '@/composables/useBandProfile'
import { usePublicSocialLinks } from '@/composables/usePublicSocialLinks'
import { useLang } from '@/composables/useLang'
import SiteNav from '@/components/public/SiteNav.vue'
import SiteFooter from '@/components/public/SiteFooter.vue'
import CheckerStrip from '@/components/public/CheckerStrip.vue'
import { API_BASE, jsonHeaders } from '@/api/client'

const { lang } = useLang()
const { query: profileQ } = useBandProfile()
const { query: linksQ } = usePublicSocialLinks()
const profile   = computed(() => profileQ.data.value)
const socials   = computed(() => linksQ.data.value ?? [])

type Reason = 'general' | 'booking' | 'press' | 'other'
const reason   = ref<Reason>('general')
const fname    = ref('')
const femail   = ref('')
const fsubject = ref('')
const fmessage = ref('')
const fhoneypot = ref('')
const sending  = ref(false)
const sent     = ref(false)
const hasErr   = ref(false)

const formEl = ref<HTMLElement | null>(null)
function scrollToForm() {
  const el = formEl.value
  if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 80, behavior: 'smooth' })
}

async function submit(e: Event) {
  e.preventDefault()
  if (!fname.value.trim() || !femail.value.includes('@') || !fmessage.value.trim()) { hasErr.value = true; return }
  hasErr.value = false
  sending.value = true
  try {
    const res = await fetch(`${API_BASE}/api/contact`, {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ reason: reason.value, name: fname.value, email: femail.value, subject: fsubject.value, message: fmessage.value, website: fhoneypot.value }),
    })
    if (res.ok) sent.value = true
    else hasErr.value = true
  } catch { hasErr.value = true }
  finally { sending.value = false }
}

function reset() {
  fname.value = ''; femail.value = ''; fsubject.value = ''; fmessage.value = ''
  reason.value = 'general'; sent.value = false; hasErr.value = false
}

const openFaq = ref(0)
function toggleFaq(i: number) { openFaq.value = openFaq.value === i ? -1 : i }

const bookingEmail = computed(() => profile.value?.booking_email ?? 'booking@skankingstorks.com')
const pressEmail   = computed(() => profile.value?.press_email   ?? 'press@skankingstorks.com')

const T = {
  en: {
    kicker: 'GET IN TOUCH',
    heroTitle: 'Contact',
    lead: 'Booking a show, a press request, or just want to say BIG UP SKA? Drop us a line — we reply within 48 hours.',
    replyBadge: 'Replies within 48h',
    basedIn: 'Based in Warszawa, PL',
    sendMsgBtn: 'Send a message',
    bookUsBtn: 'Book us',
    formTitle: 'Send a message',
    formSub: 'Fill in the form and hit send — it lands straight in our inbox.',
    reasonLabel: "What's this about?",
    reasons: [
      { v: 'general', l: 'Say hello' },
      { v: 'booking', l: 'Booking' },
      { v: 'press',   l: 'Press' },
      { v: 'other',   l: 'Other' },
    ] as { v: Reason; l: string }[],
    nameLabel:    'Your name',      namePh:    'Jane Skankowska',
    emailLabel:   'Email',          emailPh:   'you@email.com',
    subjectLabel: 'Subject',        subjectPh: "What's on your mind?",
    msgLabel:     'Message',        msgPh:     'Tell us everything — dates, venue, capacity, the lot.',
    send: 'Send message',   sending: 'Sending…',
    sent: "Message sent — we'll be in touch within 48h. BIG UP!",
    sendAnother: 'Send another',
    formErr: 'Please add your name, a valid email and a message.',
    replyNote: 'Replies within 48h',
    directTitle: 'Reach us directly',
    bookingLabel: 'Booking',  bookingNote: 'Shows, festivals, private parties',
    pressLabel:   'Press',    pressNote:   'Interviews, premieres, reviews',
    generalLabel: 'General',  generalNote: 'Everything else — say hi!',
    followLabel: 'Or find us on',
    promoTitle: 'Promoters & press',
    promoSub: 'Everything you need to put us on your stage — or your page.',
    bookTitle: 'Book us',        bookSub: 'Check open dates and send a request.',   bookCta: 'Check availability',
    epkTitle:  'Press kit (EPK)', epkSub:  'Bio, hi-res photos, logos & stats in one pack.', epkCta: 'Open EPK',
    riderTitle: 'Tech rider',    riderSub: 'Stage plan, input list, monitors & hospitality.', riderCta: 'View rider',
    photosTitle: 'Press photos', photosSub: 'Hi-res, print-ready shots in the gallery.',      photosCta: 'Open gallery',
    faqTitle: 'Quick answers',
    faqSub: 'The things promoters and fans ask us most.',
    faqs: [
      { q: 'How far ahead should we book you?',
        a: "Four to eight weeks is ideal for clubs; festivals we'll happily pencil in months out. Tight on time? Ask anyway — we love a last-minute skank." },
      { q: 'How big is the band on stage?',
        a: 'Six players plus one sound tech — a full brass-and-rhythm line-up. Stage minimum is roughly 6 × 4 m; full input list and stage plan are in the tech rider.' },
      { q: 'Do you travel outside Poland?',
        a: "Absolutely. We're Warszawa-based but tour-ready across Europe — sort the logistics with us and we'll bring the upbeat." },
      { q: 'Can we get a custom set length?',
        a: "Standard set runs 60–90 minutes. Need a short festival slot or a two-set club night? Tell us in the form and we'll tailor it." },
    ],
  },
  pl: {
    kicker: 'SKONTAKTUJ SIĘ',
    heroTitle: 'Kontakt',
    lead: 'Booking koncertu, zapytanie prasowe, a może po prostu chcesz powiedzieć BIG UP SKA? Napisz do nas — odpowiadamy w 48 godzin.',
    replyBadge: 'Odpowiedź w 48h',
    basedIn: 'Z Warszawy, PL',
    sendMsgBtn: 'Napisz do nas',
    bookUsBtn: 'Zarezerwuj nas',
    formTitle: 'Napisz do nas',
    formSub: 'Wypełnij formularz i wyślij — trafi prosto na naszą skrzynkę.',
    reasonLabel: 'W jakiej sprawie?',
    reasons: [
      { v: 'general', l: 'Przywitaj się' },
      { v: 'booking', l: 'Booking' },
      { v: 'press',   l: 'Prasa' },
      { v: 'other',   l: 'Inne' },
    ] as { v: Reason; l: string }[],
    nameLabel:    'Imię i nazwisko', namePh:    'Jan Skankowski',
    emailLabel:   'Email',           emailPh:   'ty@email.com',
    subjectLabel: 'Temat',           subjectPh: 'O czym chcesz napisać?',
    msgLabel:     'Wiadomość',       msgPh:     'Napisz wszystko — daty, miejsce, pojemność sali, całość.',
    send: 'Wyślij wiadomość', sending: 'Wysyłanie…',
    sent: 'Wiadomość wysłana — odezwiemy się w 48h. BIG UP!',
    sendAnother: 'Wyślij kolejną',
    formErr: 'Podaj imię, poprawny email i treść wiadomości.',
    replyNote: 'Odpowiedź w 48h',
    directTitle: 'Napisz bezpośrednio',
    bookingLabel: 'Booking', bookingNote: 'Koncerty, festiwale, imprezy prywatne',
    pressLabel:   'Prasa',   pressNote:   'Wywiady, premiery, recenzje',
    generalLabel: 'Ogólny',  generalNote: 'Wszystko inne — cześć!',
    followLabel: 'Albo znajdź nas na',
    promoTitle: 'Organizatorzy i prasa',
    promoSub: 'Wszystko, czego potrzebujesz, by zaprosić nas na scenę — lub na łamy.',
    bookTitle: 'Zarezerwuj nas',  bookSub: 'Sprawdź wolne terminy i wyślij zapytanie.',  bookCta: 'Sprawdź dostępność',
    epkTitle:  'Press kit (EPK)', epkSub:  'Bio, zdjęcia hi-res, loga i statystyki w jednej paczce.',  epkCta: 'Otwórz EPK',
    riderTitle: 'Rider techniczny', riderSub: 'Plan sceny, lista wejść, monitory i hospitality.', riderCta: 'Podgląd ridera',
    photosTitle: 'Zdjęcia prasowe', photosSub: 'Hi-res, gotowe do druku — w galerii.',             photosCta: 'Otwórz galerię',
    faqTitle: 'Szybkie odpowiedzi',
    faqSub: 'To, o co najczęściej pytają organizatorzy i fani.',
    faqs: [
      { q: 'Z jakim wyprzedzeniem rezerwować?',
        a: 'Cztery do ośmiu tygodni to ideał dla klubów; festiwale chętnie wpiszemy z wielomiesięcznym wyprzedzeniem. Mniej czasu? I tak pytaj — uwielbiamy skank na ostatnią chwilę.' },
      { q: 'Ilu was jest na scenie?',
        a: 'Sześciu muzyków plus realizator dźwięku — pełna sekcja dęta i rytmiczna. Minimalna scena to ok. 6 × 4 m; pełna lista wejść i plan sceny są w riderze.' },
      { q: 'Czy gracie poza Polską?',
        a: 'Oczywiście. Bazujemy w Warszawie, ale jesteśmy gotowi na trasę po całej Europie — dogadajmy logistykę, a my przywieziemy upbeat.' },
      { q: 'Czy można ustalić długość setu?',
        a: 'Standardowy set to 60–90 minut. Potrzebujesz krótkiego slotu festiwalowego albo dwóch setów w klubie? Napisz w formularzu, dopasujemy.' },
    ],
  },
}
const t = computed(() => T[lang.value])
</script>

<template>
  <div class="cp">
    <SiteNav active="contact" />

    <!-- HERO -->
    <section class="hero">
      <div class="hero-checker" />
      <div class="hero-inner">
        <span class="hero-kicker">{{ t.kicker }}</span>
        <h1 class="hero-title">{{ t.heroTitle }}</h1>
        <p class="hero-lead">{{ t.lead }}</p>
        <div class="hero-btns">
          <button class="btn-primary" @click="scrollToForm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>
            {{ t.sendMsgBtn }}
          </button>
          <RouterLink to="/concerts" class="btn-outline">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>
            {{ t.bookUsBtn }}
          </RouterLink>
        </div>
        <div class="hero-pills">
          <span class="hero-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>
            {{ t.replyBadge }}
          </span>
          <span class="hero-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>
            {{ t.basedIn }}
          </span>
        </div>
      </div>
    </section>
    <CheckerStrip :h="16" :size="22" color-a="#E2702A" color-b="#EFE7D6" />

    <!-- FORM + DIRECT CONTACTS -->
    <section class="form-section">
      <div class="form-grid">

        <!-- Contact form card -->
        <div ref="formEl" class="form-card">
          <!-- dark header -->
          <div class="form-card-head">
            <div class="form-card-checker" />
            <div>
              <h2 class="form-card-title">{{ t.formTitle }}</h2>
              <p class="form-card-sub">{{ t.formSub }}</p>
            </div>
          </div>

          <!-- sent state -->
          <div v-if="sent" class="form-sent">
            <div class="form-sent-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4.5 4.5L19 6"/></svg>
            </div>
            <p class="form-sent-msg">{{ t.sent }}</p>
            <button class="btn-ink" @click="reset">{{ t.sendAnother }}</button>
          </div>

          <!-- form body -->
          <form v-else class="form-body" @submit="submit">
            <input v-model="fhoneypot" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden" />
            <div>
              <span class="field-label">{{ t.reasonLabel }}</span>
              <div class="reason-row">
                <button
                  v-for="r in t.reasons"
                  :key="r.v"
                  type="button"
                  class="reason-btn"
                  :class="{ 'reason-btn--on': reason === r.v }"
                  @click="reason = r.v"
                >{{ r.l }}</button>
              </div>
            </div>

            <div class="field-2col">
              <div>
                <label class="field-label">{{ t.nameLabel }}</label>
                <input v-model="fname" class="field" :placeholder="t.namePh" required />
              </div>
              <div>
                <label class="field-label">{{ t.emailLabel }}</label>
                <input v-model="femail" type="email" class="field" :placeholder="t.emailPh" required />
              </div>
            </div>

            <div>
              <label class="field-label">{{ t.subjectLabel }}</label>
              <input v-model="fsubject" class="field" :placeholder="t.subjectPh" />
            </div>

            <div>
              <label class="field-label">{{ t.msgLabel }}</label>
              <textarea v-model="fmessage" class="field field--ta" rows="6" :placeholder="t.msgPh" required />
            </div>

            <div v-if="hasErr" class="form-err">
              <span class="form-err-dot" />{{ t.formErr }}
            </div>

            <div class="form-footer">
              <span class="form-reply-note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>
                {{ t.replyNote }}
              </span>
              <button type="submit" class="btn-submit" :disabled="sending">
                {{ sending ? t.sending : t.send }}
                <svg v-if="!sending" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </button>
            </div>
          </form>
        </div>

        <!-- Direct contacts sidebar -->
        <aside class="contacts-aside">
          <div class="contacts-head">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            <h2 class="contacts-title">{{ t.directTitle }}</h2>
          </div>

          <a :href="`mailto:${bookingEmail}`" class="contact-card">
            <div class="cc-label-row">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>
              <span class="cc-label">{{ t.bookingLabel }}</span>
            </div>
            <div class="cc-email">{{ bookingEmail }}</div>
            <div class="cc-note">{{ t.bookingNote }}</div>
          </a>

          <a :href="`mailto:${pressEmail}`" class="contact-card">
            <div class="cc-label-row">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H5v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2C9 14.3 10 12.7 10 10V8a1 1 0 0 0-1-1zm9 0h-4v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2c2.4-1 3.4-2.6 3.4-5.4V8a1 1 0 0 0-1-1z" fill="currentColor" stroke="none"/></svg>
              <span class="cc-label">{{ t.pressLabel }}</span>
            </div>
            <div class="cc-email">{{ pressEmail }}</div>
            <div class="cc-note">{{ t.pressNote }}</div>
          </a>

          <a href="mailto:hello@skankingstorks.com" class="contact-card">
            <div class="cc-label-row">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>
              <span class="cc-label">{{ t.generalLabel }}</span>
            </div>
            <div class="cc-email">hello@skankingstorks.com</div>
            <div class="cc-note">{{ t.generalNote }}</div>
          </a>

          <!-- Social follow row -->
          <div v-if="socials.length" class="social-card">
            <span class="social-label">{{ t.followLabel }}</span>
            <div class="social-icons">
              <a
                v-for="s in socials"
                :key="s.id"
                :href="s.url"
                target="_blank"
                rel="noopener noreferrer"
                class="social-icon-btn"
                :title="s.platform"
              >
                {{ s.platform.slice(0, 2).toUpperCase() }}
              </a>
            </div>
          </div>
        </aside>
      </div>
    </section>
    <CheckerStrip :h="14" :size="20" color-a="#121212" color-b="#EFE7D6" />

    <!-- PROMOTERS & PRESS -->
    <section class="promo-section">
      <div class="promo-head">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10M8 11l4 4 4-4M5 19h14"/></svg>
        <h2 class="promo-title">{{ t.promoTitle }}</h2>
      </div>
      <p class="promo-sub">{{ t.promoSub }}</p>

      <div class="promo-grid">
        <!-- Book us -->
        <button class="promo-card" @click="scrollToForm">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>
          <div class="promo-card-body">
            <h3 class="promo-card-title">{{ t.bookTitle }}</h3>
            <p class="promo-card-sub">{{ t.bookSub }}</p>
          </div>
          <span class="promo-cta">{{ t.bookCta }}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>
        </button>

        <!-- EPK -->
        <RouterLink to="/epk" class="promo-card">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.2 5.3 5.3 1.2-5.3 1.2L12 16.5l-1.2-5.3L5.5 10l5.3-1.2z" fill="#E2702A" stroke="none"/></svg>
          <div class="promo-card-body">
            <h3 class="promo-card-title">{{ t.epkTitle }}</h3>
            <p class="promo-card-sub">{{ t.epkSub }}</p>
          </div>
          <span class="promo-cta">{{ t.epkCta }}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>
        </RouterLink>

        <!-- Tech rider -->
        <RouterLink to="/tech-rider" class="promo-card">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
          <div class="promo-card-body">
            <h3 class="promo-card-title">{{ t.riderTitle }}</h3>
            <p class="promo-card-sub">{{ t.riderSub }}</p>
          </div>
          <span class="promo-cta">{{ t.riderCta }}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>
        </RouterLink>

        <!-- Press photos -->
        <RouterLink to="/photos" class="promo-card">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E2702A" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L18 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.4"/></svg>
          <div class="promo-card-body">
            <h3 class="promo-card-title">{{ t.photosTitle }}</h3>
            <p class="promo-card-sub">{{ t.photosSub }}</p>
          </div>
          <span class="promo-cta">{{ t.photosCta }}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>
        </RouterLink>
      </div>
    </section>
    <CheckerStrip :h="14" :size="20" color-a="#E2702A" color-b="#EFE7D6" />

    <!-- FAQ -->
    <section class="faq-section">
      <div class="faq-head">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#E2702A" stroke="none" style="flex-shrink:0"><path d="M9 7H5v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2C9 14.3 10 12.7 10 10V8a1 1 0 0 0-1-1zm9 0h-4v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2c2.4-1 3.4-2.6 3.4-5.4V8a1 1 0 0 0-1-1z"/></svg>
        <h2 class="faq-title">{{ t.faqTitle }}</h2>
      </div>
      <p class="faq-sub">{{ t.faqSub }}</p>

      <div class="faq-list">
        <div v-for="(item, i) in t.faqs" :key="i" class="faq-item">
          <button class="faq-q" :aria-expanded="openFaq === i" @click="toggleFaq(i)">
            <span>{{ item.q }}</span>
            <span class="faq-toggle" :class="{ 'faq-toggle--open': openFaq === i }">
              {{ openFaq === i ? '–' : '+' }}
            </span>
          </button>
          <p v-if="openFaq === i" class="faq-a">{{ item.a }}</p>
        </div>
      </div>
    </section>

    <SiteFooter />
  </div>
</template>

<style scoped>
.cp { background: #EFE7D6; color: #121212; font-family: 'Archivo', sans-serif; }

/* HERO */
.hero { position: relative; background: #121212; color: #EFE7D6; overflow: hidden; }
.hero-checker {
  position: absolute; inset: 0;
  background-image: repeating-conic-gradient(rgba(255,255,255,.05) 0% 25%, transparent 0% 50%);
  background-size: 32px 32px;
}
.hero-inner { position: relative; padding: 54px 90px 58px; }
.hero-kicker { display: block; font: 800 14px/1 'Archivo', sans-serif; letter-spacing: .34em; color: #E2702A; text-transform: uppercase; margin-bottom: 16px; }
.hero-title { font: 400 140px/.82 'Anton', sans-serif; text-transform: uppercase; margin: 0; }
.hero-lead { font: 500 20px/1.55 'Archivo', sans-serif; color: rgba(239,231,214,.82); max-width: 680px; margin: 22px 0 0; }
.hero-btns { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 28px; }
.btn-primary {
  display: inline-flex; align-items: center; gap: 10px;
  background: #E2702A; color: #fff; border: none;
  font: 400 18px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 15px 24px; cursor: pointer; box-shadow: 5px 5px 0 #EFE7D6;
}
.btn-outline {
  display: inline-flex; align-items: center; gap: 10px;
  background: transparent; color: #EFE7D6;
  border: 3px solid #EFE7D6;
  font: 400 18px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 15px 24px; text-decoration: none;
}
.hero-pills { display: flex; flex-wrap: wrap; gap: 22px; margin-top: 26px; }
.hero-pill {
  display: inline-flex; align-items: center; gap: 9px;
  font: 700 14px/1 'Archivo', sans-serif; letter-spacing: .06em; text-transform: uppercase;
  color: rgba(239,231,214,.7);
}

/* FORM SECTION */
.form-section { padding: 56px 90px 54px; }
.form-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 48px; align-items: start; }

/* Form card */
.form-card { border: 4px solid #121212; background: #fff; box-shadow: 10px 10px 0 #121212; }
.form-card-head {
  background: #121212; color: #EFE7D6;
  padding: 22px 28px; display: flex; align-items: center; gap: 14px;
}
.form-card-checker {
  width: 30px; height: 30px; flex-shrink: 0;
  background-image: repeating-conic-gradient(#E2702A 0% 25%, #EFE7D6 0% 50%);
  background-size: 10px 10px;
  border: 2px solid #EFE7D6;
}
.form-card-title { font: 400 30px/1 'Anton', sans-serif; text-transform: uppercase; margin: 0; }
.form-card-sub { font: 500 13px/1.4 'Archivo', sans-serif; color: rgba(239,231,214,.7); margin: 6px 0 0; }

/* Sent state */
.form-sent { padding: 56px 36px; text-align: center; }
.form-sent-icon {
  width: 70px; height: 70px; margin: 0 auto 24px; border-radius: 50%;
  background: #E2702A; display: grid; place-items: center; box-shadow: 5px 5px 0 #121212;
}
.form-sent-msg { font: 400 30px/1.05 'Anton', sans-serif; text-transform: uppercase; max-width: 460px; margin: 0 auto 22px; }
.btn-ink {
  background: #121212; color: #EFE7D6; border: none;
  font: 400 16px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 13px 22px; cursor: pointer; box-shadow: 5px 5px 0 #E2702A;
}

/* Form body */
.form-body { padding: 28px 28px 30px; display: flex; flex-direction: column; gap: 22px; }
.field-label {
  display: block; font: 800 11px/1 'Archivo', sans-serif;
  letter-spacing: .12em; text-transform: uppercase; color: #7a7468; margin-bottom: 9px;
}
.field-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.field {
  width: 100%; box-sizing: border-box;
  border: 3px solid #121212; background: #EFE7D6; padding: 14px 16px;
  font: 600 16px/1.3 'Archivo', sans-serif; color: #121212; outline: none;
}
.field:focus { outline: 3px solid #E2702A; outline-offset: -3px; }
.field--ta { resize: vertical; min-height: 130px; line-height: 1.5; font-family: 'Archivo', sans-serif; }
.reason-row { display: flex; flex-wrap: wrap; gap: 9px; }
.reason-btn {
  border: 2.5px solid #121212; background: transparent; color: #121212;
  font: 800 12px/1 'Archivo', sans-serif; letter-spacing: .06em; text-transform: uppercase;
  padding: 11px 16px; cursor: pointer;
}
.reason-btn--on { background: #121212; color: #EFE7D6; box-shadow: 4px 4px 0 #E2702A; }
.form-err { display: flex; align-items: center; gap: 8px; font: 600 14px/1.4 'Archivo', sans-serif; color: #C23A2B; }
.form-err-dot { width: 8px; height: 8px; background: #C23A2B; flex-shrink: 0; }
.form-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.form-reply-note {
  display: inline-flex; align-items: center; gap: 8px;
  font: 600 13px/1.3 'Archivo', sans-serif; color: #7a7468;
}
.btn-submit {
  display: inline-flex; align-items: center; gap: 10px;
  background: #E2702A; color: #fff; border: none;
  font: 400 20px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 16px 28px; cursor: pointer; box-shadow: 6px 6px 0 #121212;
}
.btn-submit:disabled { opacity: .5; cursor: not-allowed; }

/* Contacts aside */
.contacts-aside { display: flex; flex-direction: column; gap: 16px; }
.contacts-head { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
.contacts-title { font: 400 30px/1 'Anton', sans-serif; text-transform: uppercase; margin: 0; }
.contact-card {
  display: block; background: #121212; color: #EFE7D6;
  padding: 18px 20px; text-decoration: none;
  box-shadow: 6px 6px 0 #E2702A;
}
.cc-label-row { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }
.cc-label { font: 800 11px/1 'Archivo', sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #E2702A; }
.cc-email { font: 700 17px/1.2 'Archivo', sans-serif; word-break: break-word; }
.cc-note { font: 500 13px/1.4 'Archivo', sans-serif; color: rgba(239,231,214,.6); margin-top: 7px; }
.social-card { border: 3px solid #121212; background: #fff; padding: 18px 20px; }
.social-label { font: 800 11px/1 'Archivo', sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #8a8475; }
.social-icons { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 14px; }
.social-icon-btn {
  width: 44px; height: 44px; border: 2.5px solid #121212; border-radius: 50%;
  display: grid; place-items: center;
  font: 800 11px/1 'Archivo', sans-serif; letter-spacing: .04em;
  color: #121212; text-decoration: none;
}

/* PROMOTERS */
.promo-section { padding: 56px 90px; }
.promo-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.promo-title { font: 400 56px/.96 'Anton', sans-serif; text-transform: uppercase; margin: 0; }
.promo-sub { font: 500 17px/1.5 'Archivo', sans-serif; color: #444; margin: 14px 0 28px; max-width: 620px; }
.promo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
.promo-card {
  display: flex; flex-direction: column; gap: 14px;
  border: 3px solid #121212; background: #fff;
  padding: 22px 20px; box-shadow: 6px 6px 0 #121212;
  text-align: left; text-decoration: none; color: #121212; cursor: pointer;
  font: inherit; appearance: none;
}
.promo-card:hover { box-shadow: 8px 8px 0 #E2702A; }
.promo-card-body { flex: 1; }
.promo-card-title { font: 400 23px/1.02 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 8px; }
.promo-card-sub { font: 500 13px/1.45 'Archivo', sans-serif; color: #666; margin: 0; }
.promo-cta {
  display: inline-flex; align-items: center; gap: 8px;
  font: 800 12px/1 'Archivo', sans-serif; letter-spacing: .08em; text-transform: uppercase;
  color: #E2702A;
}

/* FAQ */
.faq-section { padding: 54px 90px 60px; }
.faq-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.faq-title { font: 400 56px/.96 'Anton', sans-serif; text-transform: uppercase; margin: 0; }
.faq-sub { font: 500 17px/1.5 'Archivo', sans-serif; color: #444; margin: 14px 0 26px; max-width: 620px; }
.faq-list { border-top: 3px solid #121212; }
.faq-item { border-bottom: 3px solid #121212; }
.faq-q {
  all: unset; box-sizing: border-box; width: 100%; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  padding: 22px 4px;
  font: 400 26px/1.05 'Anton', sans-serif; text-transform: uppercase; color: #121212;
}
.faq-q:hover { color: #E2702A; }
.faq-toggle {
  width: 34px; height: 34px; flex-shrink: 0;
  border: 2.5px solid #121212; display: grid; place-items: center;
  font: 800 22px/1 'Archivo', sans-serif; background: transparent; color: #121212;
}
.faq-toggle--open { background: #E2702A; border-color: #E2702A; color: #fff; }
.faq-a { font: 500 17px/1.6 'Archivo', sans-serif; color: #2a2a2a; margin: 0 4px 24px; max-width: 760px; }

/* Responsive */
@media (max-width: 1100px) {
  .hero-inner, .form-section, .promo-section, .faq-section { padding-left: 40px; padding-right: 40px; }
  .hero-title { font-size: 100px; }
}
@media (max-width: 900px) {
  .form-grid { grid-template-columns: 1fr; }
  .promo-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 700px) {
  .hero-inner, .form-section, .promo-section, .faq-section { padding-left: 20px; padding-right: 20px; }
  .hero-title { font-size: 64px; }
  .field-2col { grid-template-columns: 1fr; }
  .promo-grid { grid-template-columns: 1fr; }
}
</style>
