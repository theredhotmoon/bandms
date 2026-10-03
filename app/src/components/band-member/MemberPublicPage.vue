<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import { useBandProfile } from '@/composables/useBandProfile'
import { memberPageUrl } from '@/utils/memberPageUrl'
import type { BandMember } from '@bandms/rider-core'

/**
 * A member's public page as the admin sees it: the link, a QR code for it and
 * a printable card. Everything is generated in the browser — no QR service,
 * so the CSP stays closed and nothing leaves the panel.
 */
const props = defineProps<{ member: BandMember }>()

const { t } = useI18n()
const { query: modulesQuery } = useWebsiteModules()
const { query: profileQuery } = useBandProfile()
const bandName = computed(() => profileQuery.data.value?.name ?? '')

const url = computed(() => memberPageUrl(window.location.origin, modulesQuery.data.value?.data, props.member.slug))

// The page is only built while the About module and its Members section are
// on. Offering a QR code for a page that does not exist would print a 404.
// Unknown (modules not loaded, or not readable for this role) counts as
// published, the same "absent means on" rule the public site uses.
const published = computed(() => {
  const about = modulesQuery.data.value?.data?.find((m) => m.slug === 'about')
  return !about || (about.enabled !== false && about.visibility?.show_members !== false)
})
const name = computed(() =>
  [props.member.first_name, props.member.nickname ? `“${props.member.nickname}”` : null, props.member.last_name]
    .filter(Boolean)
    .join(' '),
)

const qrPng = ref('')
const qrSvg = ref('')

watch(url, async (value) => {
  if (!value) { qrPng.value = ''; qrSvg.value = ''; return }
  // High error correction: a printed card gets scuffed, folded and taped up.
  const options = { errorCorrectionLevel: 'H' as const, margin: 2 }
  qrPng.value = await QRCode.toDataURL(value, { ...options, width: 1024 })
  qrSvg.value = await QRCode.toString(value, { ...options, type: 'svg' })
}, { immediate: true })

const fileBase = computed(() => `qr-${props.member.slug ?? 'member'}`)
const svgHref = computed(() => (qrSvg.value ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg.value)}` : ''))

async function copyLink() {
  if (!url.value) return
  try {
    await navigator.clipboard.writeText(url.value)
    toast.success(t('band.members.publicPage.copied'))
  } catch {
    toast.error(t('band.members.publicPage.copyFailed'))
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!) // i18n-ignore: HTML entity map

/**
 * An A6 card in its own window, so the print carries nothing of the panel.
 * Black on white whatever theme the admin wears: it is a document.
 */
function printCard() {
  if (!url.value || !qrSvg.value) return
  const win = window.open('', '_blank', 'width=600,height=800')
  if (!win) return
  const role = props.member.role ? `<p class="role">${escapeHtml(props.member.role)}</p>` : '' // i18n-ignore: print-card markup
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name.value)}</title>
<style>
  @page { size: A6; margin: 8mm; }
  body { margin: 0; font-family: system-ui, sans-serif; color: #000; background: #fff; text-align: center; } /* token-lint-ignore: printed card, black on white in either theme */
  .card { display: flex; flex-direction: column; align-items: center; gap: 3mm; }
  .band { font-size: 9pt; letter-spacing: .15em; text-transform: uppercase; margin: 0; }
  h1 { font-size: 20pt; margin: 0; line-height: 1.1; }
  .role { font-size: 10pt; margin: 0; }
  .qr svg { width: 60mm; height: 60mm; }
  .scan { font-size: 9pt; margin: 0; }
  .url { font-size: 7pt; margin: 0; word-break: break-all; }
</style></head><body><div class="card">
  <p class="band">${escapeHtml(bandName.value)}</p>
  <h1>${escapeHtml(name.value)}</h1>${role}
  <div class="qr">${qrSvg.value}</div>
  <p class="scan">${escapeHtml(t('band.members.publicPage.scan', { name: props.member.first_name }))}</p>
  <p class="url">${escapeHtml(url.value)}</p>
</div></body></html>`)
  win.document.close()
  // Printed from here, not by a script inside the card: the panel's CSP
  // carries over to the new window and would block an inline one.
  win.focus()
  win.print()
}
</script>

<template>
  <section class="public-page" data-testid="member-public-page">
    <h3 class="pp-title">{{ $t('band.members.publicPage.title') }}</h3>
    <p class="pp-hint">{{ $t('band.members.publicPage.hint') }}</p>

    <p v-if="!url" class="pp-empty">{{ $t('band.members.publicPage.noSlug') }}</p>

    <template v-else>
      <p v-if="!published" class="pp-warning" data-testid="member-page-unpublished">{{ $t('band.members.publicPage.unpublished') }}</p>
      <div class="pp-link">
        <code class="pp-url" data-testid="member-public-url">{{ url }}</code>
        <button type="button" class="btn-ghost" @click="copyLink">{{ $t('band.members.publicPage.copy') }}</button>
        <a class="btn-ghost" :href="url" target="_blank" rel="noopener">{{ $t('band.members.publicPage.open') }}</a>
      </div>

      <div v-if="published" class="pp-qr-row">
        <img
          v-if="qrPng"
          :src="qrPng"
          class="pp-qr"
          :alt="$t('band.members.publicPage.qrAlt', { name })"
          data-testid="member-qr"
        />
        <div class="pp-actions">
          <a class="btn-ghost" :href="qrPng" :download="`${fileBase}.png`">{{ $t('band.members.publicPage.downloadPng') }}</a>
          <a class="btn-ghost" :href="svgHref" :download="`${fileBase}.svg`" data-testid="member-qr-svg">{{ $t('band.members.publicPage.downloadSvg') }}</a>
          <button type="button" class="btn-primary" @click="printCard">{{ $t('band.members.publicPage.print') }}</button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.public-page { display: flex; flex-direction: column; gap: 1rem; max-width: 46rem; }
.pp-title { font-size: var(--fs-lg); font-weight: 600; color: var(--c-e2e8f0); margin: 0; }
.pp-hint, .pp-empty { font-size: var(--fs-sm); color: var(--c-94a3b8); margin: 0; line-height: 1.6; }
.pp-warning {
  font-size: var(--fs-sm); line-height: 1.6; margin: 0; padding: 0.625rem 0.75rem; border-radius: 0.375rem;
  color: var(--c-fbbf24); background: color-mix(in srgb, var(--c-fbbf24) 10%, transparent);
}
.pp-link { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.pp-url {
  flex: 1 1 18rem; padding: 0.5rem 0.75rem; border-radius: 0.375rem;
  background: var(--c-141414); border: 1px solid var(--c-2a2a2a);
  font-size: var(--fs-sm); color: var(--c-e2e8f0); word-break: break-all;
}
.pp-qr-row { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-start; }
/* The code sits on white in both themes: scanners need the contrast. */
.pp-qr { width: 12rem; height: 12rem; border-radius: 0.5rem; background: #fff; padding: 0.5rem; } /* token-lint-ignore: a QR code needs a white quiet zone in both themes */
.pp-actions { display: flex; flex-direction: column; gap: 0.5rem; align-items: stretch; }
</style>
