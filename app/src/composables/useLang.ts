import { ref } from 'vue'

export type Lang = 'en' | 'pl'

const stored = localStorage.getItem('site_lang') as Lang | null
const lang = ref<Lang>(stored === 'pl' ? 'pl' : 'en')

export function useLang() {
  function setLang(l: Lang): void {
    lang.value = l
    localStorage.setItem('site_lang', l)
  }

  return { lang, setLang }
}
