import en from './en'

export type MessageSchema = typeof en

/**
 * Forces the pl catalogue to mirror en: a missing Polish translation is a
 * TS2322 on pl/index.ts. That guarantee is real and tested.
 *
 * It does NOT key-check call sites, which this comment claimed until it was
 * tested. Verified: t('shows.totally.bogus.key') compiles clean under
 * `vue-tsc -b` and renders the raw dotted key on screen.
 * scripts/check-i18n-keys.mjs is what catches that, and it runs in the build.
 */
declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
