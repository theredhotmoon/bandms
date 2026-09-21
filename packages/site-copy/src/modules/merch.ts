import { defineCopy } from '../resolve'

/**
 * The Merch page, item pages, the cart drawer that lives in the site header,
 * and the order-confirmed / checkout-cancelled landing pages Stripe returns to.
 */
export const MERCH_COPY = defineCopy([
  // ── Page header ─────────────────────────────────────────────────────
  {
    key: 'title', label: 'Page title', group: 'Page header', maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    defaults: { en: 'Merch', pl: 'Merch' },
  },
  {
    key: 'lead', label: 'Wording below title', group: 'Page header', type: 'textarea', maxLength: 400,
    help: 'Sits under the title in the page header, and doubles as the page meta description. Empty hides it.',
    defaults: { en: '', pl: '' },
  },
  {
    key: 'emptyTitle', label: 'Empty state: title', group: 'Page header', maxLength: 120,
    help: 'Shown when nothing is on sale.',
    defaults: { en: 'No items available right now.', pl: 'Obecnie nic nie jest dostępne.' },
  },
  {
    key: 'emptySub', label: 'Empty state: subtitle', group: 'Page header', maxLength: 160,
    defaults: {
      en: 'Check back soon, or subscribe to the newsletter for updates.',
      pl: 'Zajrzyj wkrótce albo zapisz się do newslettera.',
    },
  },
  {
    key: 'emptyLink', label: 'Empty state: newsletter link', group: 'Page header', maxLength: 40,
    defaults: { en: 'Subscribe →', pl: 'Zapisz się →' },
  },

  // ── Items ───────────────────────────────────────────────────────────
  {
    key: 'preorder', label: '"Pre-order" badge', group: 'Item cards & pages', maxLength: 30,
    defaults: { en: 'PRE-ORDER', pl: 'PRZEDSPRZEDAŻ' },
  },
  {
    key: 'soldOut', label: '"Sold out" overlay', group: 'Item cards & pages', maxLength: 30,
    defaults: { en: 'Sold Out', pl: 'Wyprzedane' },
  },
  {
    key: 'presale', label: '"Pre-sale" price badge', group: 'Item cards & pages', maxLength: 30,
    defaults: { en: 'Pre-sale', pl: 'Przedsprzedaż' },
  },
  {
    key: 'optionFallback', label: 'Variant heading fallback', group: 'Item cards & pages', maxLength: 30,
    help: 'Used when a variant has no name of its own.',
    defaults: { en: 'Option', pl: 'Opcja' },
  },
  {
    key: 'buyNow', label: '"Buy now" (external link)', group: 'Item cards & pages', maxLength: 30,
    defaults: { en: 'Buy Now', pl: 'Kup teraz' },
  },
  {
    key: 'addToCart', label: '"Add to cart" button', group: 'Item cards & pages', maxLength: 30,
    defaults: { en: 'Add to Cart', pl: 'Do koszyka' },
  },
  {
    key: 'added', label: 'Button after adding', group: 'Item cards & pages', maxLength: 30,
    defaults: { en: 'Added to cart ✓', pl: 'Dodano do koszyka ✓' },
  },
  {
    key: 'outOfStock', label: '"Out of stock" button', group: 'Item cards & pages', maxLength: 30,
    defaults: { en: 'Out of stock', pl: 'Brak w magazynie' },
  },
  {
    key: 'selectOption', label: '"Select an option" button', group: 'Item cards & pages', maxLength: 30,
    defaults: { en: 'Select an option', pl: 'Wybierz opcję' },
  },
  {
    key: 'ships', label: 'Pre-sale shipping note', group: 'Item cards & pages', maxLength: 60,
    help: '{date} is filled in with the shipping month.',
    defaults: { en: 'Ships {date}', pl: 'Wysyłka {date}' },
  },
  {
    key: 'clipsTitle', label: 'Clips heading', group: 'Item cards & pages', maxLength: 60,
    help: 'Heading of the videos section on an item page. Hidden when the item has no clips.',
    defaults: { en: 'Videos', pl: 'Nagrania' },
  },

  // ── Cart ────────────────────────────────────────────────────────────
  {
    key: 'cartTitle', label: 'Drawer heading', group: 'Cart', maxLength: 30,
    defaults: { en: 'Cart', pl: 'Koszyk' },
  },
  {
    key: 'cartOpen', label: '"Open cart" (screen readers)', group: 'Cart', maxLength: 30,
    defaults: { en: 'Open cart', pl: 'Otwórz koszyk' },
  },
  {
    key: 'cartClose', label: '"Close cart" (screen readers)', group: 'Cart', maxLength: 30,
    defaults: { en: 'Close cart', pl: 'Zamknij koszyk' },
  },
  {
    key: 'cartEmpty', label: 'Empty cart', group: 'Cart', maxLength: 80,
    defaults: { en: 'Your cart is empty.', pl: 'Twój koszyk jest pusty.' },
  },
  {
    key: 'remove', label: '"Remove" link', group: 'Cart', maxLength: 30,
    defaults: { en: 'Remove', pl: 'Usuń' },
  },
  {
    key: 'total', label: '"Total" label', group: 'Cart', maxLength: 30,
    help: 'Also on the order confirmation page.',
    defaults: { en: 'Total', pl: 'Razem' },
  },
  {
    key: 'checkout', label: '"Checkout" button', group: 'Cart', maxLength: 30,
    defaults: { en: 'Checkout', pl: 'Do kasy' },
  },
  {
    key: 'secureNote', label: 'Secure checkout note', group: 'Cart', maxLength: 60,
    defaults: { en: 'Secure checkout via Stripe', pl: 'Bezpieczna płatność przez Stripe' },
  },
  {
    key: 'checkoutFailed', label: 'Checkout failed', group: 'Cart', maxLength: 120,
    defaults: { en: 'Checkout failed. Please try again.', pl: 'Płatność nie powiodła się. Spróbuj ponownie.' },
  },

  // ── Order confirmation ──────────────────────────────────────────────
  {
    key: 'orderPageTitle', label: 'Browser tab title', group: 'Order confirmed page', maxLength: 60,
    defaults: { en: 'Order confirmed', pl: 'Zamówienie przyjęte' },
  },
  {
    key: 'orderLoading', label: 'While confirming', group: 'Order confirmed page', maxLength: 60,
    defaults: { en: 'Confirming your order…', pl: 'Potwierdzamy zamówienie…' },
  },
  {
    key: 'orderTitle', label: 'Heading', group: 'Order confirmed page', maxLength: 60,
    defaults: { en: 'Payment confirmed', pl: 'Płatność potwierdzona' },
  },
  {
    key: 'orderUnknown', label: 'Order not found yet', group: 'Order confirmed page', type: 'textarea', maxLength: 300,
    defaults: {
      en: "If your payment went through you'll receive a confirmation email shortly. Nothing has been charged twice.",
      pl: 'Jeśli płatność się powiodła, wkrótce otrzymasz mail z potwierdzeniem. Nic nie zostało pobrane dwa razy.',
    },
  },
  {
    key: 'orderThanks', label: 'Thank-you line', group: 'Order confirmed page', maxLength: 160,
    defaults: {
      en: "Thanks for your order — we'll email you when it ships.",
      pl: 'Dziękujemy za zamówienie — napiszemy, gdy je wyślemy.',
    },
  },
  {
    key: 'orderNumber', label: '"Order" label', group: 'Order confirmed page', maxLength: 30,
    help: 'Before the order number.',
    defaults: { en: 'Order', pl: 'Zamówienie' },
  },
  {
    key: 'downloadTicket', label: '"Download ticket" link', group: 'Order confirmed page', maxLength: 40,
    defaults: { en: 'Download ticket →', pl: 'Pobierz bilet →' },
  },
  {
    key: 'backToMerch', label: '"Back to merch" link', group: 'Order confirmed page', maxLength: 40,
    help: 'Also on the checkout-cancelled page.',
    defaults: { en: '← Back to merch', pl: '← Wróć do merchu' },
  },

  // ── Checkout cancelled ──────────────────────────────────────────────
  {
    key: 'cancelTitle', label: 'Heading', group: 'Checkout cancelled page', maxLength: 60,
    defaults: { en: 'Checkout cancelled', pl: 'Płatność anulowana' },
  },
  {
    key: 'cancelBody', label: 'Text', group: 'Checkout cancelled page', type: 'textarea', maxLength: 300,
    defaults: {
      en: 'No payment was taken and your cart is still here. Pick up where you left off whenever you like.',
      pl: 'Nie pobraliśmy żadnej płatności, a Twój koszyk czeka. Wróć, kiedy zechcesz.',
    },
  },
])
