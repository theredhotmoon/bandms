import en from './en'

export type MessageSchema = typeof en

/**
 * Makes $t()/t() key-checked against the English catalogue, so a mistyped key
 * is a build error rather than a key name rendered on screen.
 */
declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
