import {
  resolveCopy,
  CONTACT_COPY,
  MERCH_COPY,
  NEWSLETTER_COPY,
  SITE_COPY,
  type CopyField,
  type ResolvedCopy,
} from '@bandms/site-copy'
import type { SiteConfig } from './cms'
import type { Locale } from '@/types/shared'
import { calendarNames } from './calendarNames'

/**
 * A module's copy for one locale: registry defaults overridden by whatever
 * the band saved in Website Modules. `module_config` is `{}` when the config
 * fails open, and a module absent from it has never saved a bag — both read
 * as "print the defaults", which is why the optional chain goes all the way.
 */
export function moduleCopy<F extends readonly CopyField[]>(
  siteConfig: SiteConfig,
  slug: string,
  fields: F,
  lang: string,
): ResolvedCopy<F> {
  const cfg = siteConfig.module_config?.[slug]
  return resolveCopy(fields, lang, cfg?.settings, cfg?.settings_fallback)
}

/**
 * Site-wide chrome strings — nav labels, the FAQ block, the 404 page. They
 * hang off the `site` row, which is chrome like `footer`: no route, no slug.
 */
export function siteCopy(siteConfig: SiteConfig, lang: string) {
  return moduleCopy(siteConfig, 'site', SITE_COPY, lang)
}

/**
 * Props for `NewsletterSignup.vue`, which is embedded on three pages. The
 * form's own strings live on the `newsletter` module wherever the form is
 * rendered, so editing "Join the list" once changes every copy of the form —
 * only the heading and blurb around it belong to the host page.
 */
/**
 * The availability calendar's copy, from the Contact module. Shared because the
 * calendar is mounted on more than the contact page: the concerts page and the
 * homepage open it from their "Book us" button when no gigs are announced.
 */
export function availabilityCopy(siteConfig: SiteConfig, lang: Locale) {
  const t = moduleCopy(siteConfig, 'contact', CONTACT_COPY, lang)
  const calendar = calendarNames(lang)
  return {
    title: t.calTitle, subtitle: t.calSubtitle,
    open: t.calOpen, booked: t.calBooked, held: t.calHeld,
    request: t.calRequest, pickPrompt: t.calPickPrompt, close: t.calClose,
    prevMonth: t.calPrevMonth, nextMonth: t.calNextMonth,
    loadError: t.calLoadError, loading: t.calLoading,
    confirmTitle: t.calConfirmTitle, confirmBody: t.calConfirmBody,
    confirmYes: t.calConfirmYes, confirmNo: t.calConfirmNo,
    months: calendar.months, weekdays: calendar.weekdays,
  }
}

export function newsletterFormCopy(siteConfig: SiteConfig, lang: string) {
  const t = moduleCopy(siteConfig, 'newsletter', NEWSLETTER_COPY, lang)
  return {
    placeholder: t.placeholder,
    submitLabel: t.submit,
    sendingLabel: t.sending,
    doneLabel: t.done,
    errorLabel: t.error,
  }
}

/**
 * Merch-module copy in the shapes its islands take. The cart drawer and its
 * header icon are mounted by BaseLayout on every page, so they read the
 * module's copy from the layout rather than from a page that may not exist.
 */
export function merchCopy(siteConfig: SiteConfig, lang: string) {
  return moduleCopy(siteConfig, 'merch', MERCH_COPY, lang)
}

type MerchCopy = ResolvedCopy<typeof MERCH_COPY>

export function cartCopy(t: MerchCopy) {
  return {
    title: t.cartTitle,
    close: t.cartClose,
    empty: t.cartEmpty,
    remove: t.remove,
    total: t.total,
    checkout: t.checkout,
    secureNote: t.secureNote,
    checkoutFailed: t.checkoutFailed,
  }
}

export function addToCartCopy(t: MerchCopy) {
  return {
    presale: t.presale,
    optionFallback: t.optionFallback,
    buyNow: t.buyNow,
    addToCart: t.addToCart,
    added: t.added,
    outOfStock: t.outOfStock,
    selectOption: t.selectOption,
    ships: t.ships,
  }
}

export function orderCopy(t: MerchCopy) {
  return {
    loading: t.orderLoading,
    title: t.orderTitle,
    unknown: t.orderUnknown,
    thanks: t.orderThanks,
    orderNumber: t.orderNumber,
    downloadTicket: t.downloadTicket,
    total: t.total,
    backToMerch: t.backToMerch,
  }
}
