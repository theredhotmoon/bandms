<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import RichEditor from '@/components/admin/RichEditor.vue'
import { useAssistantCapabilities, useTranslate } from '@/composables/useAssistant'
import { useContentLocales } from '@/composables/useContentLocales'
import { bagHasText, shortLabel, type Lang, type TranslationBag } from '@/locales'
import type { TranslateFormat } from '@/types/assistant'
import { VISIBLE_LOCALES } from '@/utils/editorLocales'
import { decideClick, replyStillApplies, type Armed } from '@/utils/translateButton'
import { fillKey } from '@/utils/translationFill'
import { isFilled, sourceFor } from '@/utils/translationSource'

/**
 * One translated text field: a row per content locale — badge, control and,
 * when the server can translate, a button that fills that row from the first
 * FILLED locale in content order (see utils/translationSource.ts for why that
 * is not "the primary"). Replaces the hand-rolled `.trans-row` blocks that ~12
 * forms carried, so the button exists in exactly one place.
 *
 * The button is `v-if`, never disabled: a control nobody can enable from the
 * UI is a control pretending to be one. An empty target fills on one click; a
 * filled one needs a second click inside the confirm window (utils/translateButton.ts).
 *
 * `locales` lets a host narrow the rows (the post editor's single-language
 * view); without it, `inject(VISIBLE_LOCALES)` and then the band's content
 * order decide, the way the block editors already do.
 */
const props = withDefaults(defineProps<{
  modelValue: TranslationBag
  kind: 'input' | 'textarea' | 'rich'
  /** Stable id like `concert.description` — the row's translate keys and (phase 2) style examples hang off it. */
  fieldKey: string
  /** The field's name, for each control's aria-label ("Title EN"). */
  label?: string
  /** DOM id for the FIRST row's control, so a `<label for>` can point at it. */
  id?: string
  /** Or an id per row: `${idPrefix}-${locale}` (FaqEditor's `faq-q-en`). */
  idPrefix?: string
  placeholders?: Partial<Record<Lang, string>>
  errors?: Partial<Record<Lang, string | undefined>>
  /**
   * The content-language rule: only the PRIMARY locale's control is required,
   * and only while EVERY locale is blank — so an English-only post written
   * before the band switched to Polish-first stays saveable.
   */
  required?: boolean
  locales?: Lang[]
  rows?: number
  maxlength?: number
  /** Defaults from `kind`: rich is html, the rest text. */
  format?: TranslateFormat
}>(), {
  placeholders: () => ({}),
  errors: () => ({}),
  required: false,
  rows: 2,
})

const emit = defineEmits<{ 'update:modelValue': [TranslationBag] }>()

const { t } = useI18n()
const { order, primary } = useContentLocales()
const visible = inject(VISIBLE_LOCALES, null)
const locales = computed<Lang[]>(() => props.locales ?? visible?.value ?? order.value)
const format = computed<TranslateFormat>(() => props.format ?? (props.kind === 'rich' ? 'html' : 'text'))

const { canTranslate } = useAssistantCapabilities()
const { translate, isPending: pendingKey } = useTranslate()

function set(l: Lang, value: string): void {
  emit('update:modelValue', { ...props.modelValue, [l]: value })
}

const isRequired = (l: Lang): boolean => props.required && l === primary.value && !bagHasText(props.modelValue)
const ariaLabel = (l: Lang): string | undefined => (props.label ? `${props.label} ${shortLabel(l)}` : undefined)
const controlId = (l: Lang): string | undefined =>
  props.idPrefix ? `${props.idPrefix}-${l}` : props.id && l === locales.value[0] ? props.id : undefined

function onInput(l: Lang, e: Event): void {
  set(l, (e.target as HTMLInputElement | HTMLTextAreaElement).value)
}

// ── Translate button ────────────────────────────────────────────────────────
const source = (l: Lang): Lang | null => sourceFor(props.modelValue, l, order.value)
const key = (l: Lang): string => fillKey(props.fieldKey, l)
const isPending = (l: Lang): boolean => pendingKey(key(l))

const armed = ref<Armed | null>(null)
let disarmTimer: ReturnType<typeof setTimeout> | null = null

function disarm(): void {
  armed.value = null
  if (disarmTimer) clearTimeout(disarmTimer)
  disarmTimer = null
}
onBeforeUnmount(disarm)

const isArmed = (l: Lang): boolean => armed.value?.key === key(l) && Date.now() <= armed.value.until

function buttonTitle(l: Lang): string {
  if (isArmed(l)) return t('common.assistant.replaceWithTranslation')
  const from = source(l)
  return from ? t('common.assistant.translateFrom', { lang: shortLabel(from) }) : ''
}

async function onTranslateClick(l: Lang): Promise<void> {
  const from = source(l)
  if (!from || isPending(l)) return

  const decision = decideClick({ filled: isFilled(props.modelValue[l]), armed: armed.value, key: key(l), now: Date.now() })
  if (decision.action === 'arm') {
    disarm()
    armed.value = { key: key(l), until: decision.until }
    disarmTimer = setTimeout(disarm, decision.until - Date.now())
    return
  }

  disarm()
  // The row stays editable while the request runs, and a host may swap the bag
  // under this mounted field (a reordered post block, a reloaded record). The
  // answer lands only if the row still holds what it held at click time and the
  // source still reads what was sent — utils/translateButton.ts — so nothing
  // the band wrote is overwritten and no other record receives this text.
  const sent = { target: props.modelValue[l], source: props.modelValue[from] }
  try {
    const out = await translate([{ key: key(l), text: sent.source, format: format.value, source: from, target: l }])
    const text = out[key(l)]
    if (text === undefined) return
    if (replyStillApplies(sent, { target: props.modelValue[l], source: props.modelValue[from] })) set(l, text)
    else toast.info(t('common.assistant.skippedChanged')) // a silent drop reads as "broken"
  } catch {
    // useTranslate already toasted; the field is left as it was.
  }
}
</script>

<template>
  <div class="trans-group" :data-field-key="fieldKey">
    <div
      v-for="l in locales"
      :key="l"
      class="trans-row"
      :class="{ 'trans-row--top': kind !== 'input' }"
      :data-locale="l"
    >
      <span class="lang-badge" :class="[`lang-badge--${l}`, { 'lang-badge--rich': kind === 'rich' }]">{{ shortLabel(l) }}</span>

      <div class="trans-control flex-1">
        <input
          v-if="kind === 'input'"
          :value="modelValue[l]"
          @input="onInput(l, $event)"
          type="text"
          class="field-input w-full"
          :class="{ 'field-input--error': errors[l], 'trans-control--with-button': canTranslate && source(l) }"
          :id="controlId(l)"
          :placeholder="placeholders[l]"
          :required="isRequired(l)"
          :maxlength="maxlength"
          :aria-label="ariaLabel(l)"
          :aria-invalid="Boolean(errors[l])"
          :data-testid="`trans-input-${fieldKey}-${l}`"
        />
        <textarea
          v-else-if="kind === 'textarea'"
          :value="modelValue[l]"
          @input="onInput(l, $event)"
          class="field-input w-full"
          :class="{ 'field-input--error': errors[l], 'trans-control--with-button': canTranslate && source(l) }"
          :id="controlId(l)"
          :rows="rows"
          :placeholder="placeholders[l]"
          :required="isRequired(l)"
          :maxlength="maxlength"
          :aria-label="ariaLabel(l)"
          :aria-invalid="Boolean(errors[l])"
          :data-testid="`trans-input-${fieldKey}-${l}`"
        />
        <div v-else class="trans-rich" :class="{ 'trans-control--with-button': canTranslate && source(l) }" :data-testid="`trans-input-${fieldKey}-${l}`">
          <RichEditor :model-value="modelValue[l]" @update:model-value="set(l, $event)" :placeholder="placeholders[l]" />
        </div>

        <button
          v-if="canTranslate && source(l)"
          type="button"
          class="trans-translate"
          :class="{ 'trans-translate--armed': isArmed(l), 'trans-translate--pending': isPending(l) }"
          :data-locale="l"
          :data-source="source(l)"
          :data-confirm="isArmed(l) ? 'true' : undefined"
          :disabled="isPending(l)"
          :title="buttonTitle(l)"
          :aria-label="buttonTitle(l)"
          @click="onTranslateClick(l)"
        >
          <svg v-if="isPending(l)" class="trans-spinner" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" stroke-dasharray="30 14" />
          </svg>
          <svg v-else class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M7 3.5a.75.75 0 0 1 .53.22l2.5 2.5a.75.75 0 1 1-1.06 1.06L7.75 6.06V12a.75.75 0 0 1-1.5 0V6.06L5.03 7.28a.75.75 0 0 1-1.06-1.06l2.5-2.5A.75.75 0 0 1 7 3.5Zm6 13a.75.75 0 0 1-.53-.22l-2.5-2.5a.75.75 0 1 1 1.06-1.06l1.22 1.22V8a.75.75 0 0 1 1.5 0v5.94l1.22-1.22a.75.75 0 1 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-.53.22Z" />
          </svg>
        </button>
      </div>
    </div>

    <template v-for="l in locales" :key="`err-${l}`">
      <p v-if="errors[l]" class="field-error">{{ errors[l] }}</p>
    </template>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.trans-control { position: relative; display: flex; align-items: flex-start; min-width: 0; }
.trans-control--with-button { padding-right: 2.25rem; }
.trans-rich { flex: 1; min-width: 0; }
.trans-rich + .trans-translate { top: 0.375rem; }
/* A rich editor's toolbar is taller than an input, so the badge sits beside the first line of text. */
.lang-badge--rich { margin-top: 0.5rem; }
.trans-translate {
  position: absolute;
  right: 0.375rem;
  top: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: var(--c-888888);
  cursor: pointer;
  transition: color 120ms, background 120ms;
  flex-shrink: 0;
}
.trans-translate:hover { color: var(--c-e2e8f0); background: var(--c-222222); }
.trans-translate--armed { color: var(--c-f87171); background: var(--c-3f1010); }
.trans-translate--pending { cursor: progress; }
.trans-spinner { width: 0.875rem; height: 0.875rem; animation: trans-spin 0.8s linear infinite; }
@keyframes trans-spin { to { transform: rotate(360deg); } }
</style>
