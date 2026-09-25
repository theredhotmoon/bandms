/**
 * The fan-facing surface: /account and the ticket claim page.
 *
 * NOTE: there is no fan-facing language selector. These follow `useUiLang`
 * like every other SPA surface, which for a fan means the default — English —
 * unless something has written `admin_ui_lang`. Migrating them off hardcoded
 * literals is what makes adding that selector a one-line change rather than a
 * second sweep; it does not by itself give a fan Polish.
 */
export default {
  account: {
    title: 'My Account',
    signOut: 'Sign out',
    myTickets: 'My Tickets',
    orderHistory: 'Order History',
  },

  tickets: {
    loading: 'Loading tickets…',
    loadFailed: 'Failed to load tickets.',
    empty: 'No tickets yet.',
    unknownVenue: 'Unknown venue',
    transfer: 'Transfer',
    transferStarted: 'Transfer initiated! Recipient will receive a claim link.',
    devLink: 'Dev link:',
    recipientEmail: 'Recipient email',
    recipientPlaceholder: "recipient{'@'}example.com",
    sending: 'Sending…',
    sendTransfer: 'Send transfer',
    transferFailed: 'Transfer failed.',
    /** Carries `{ref}` — the short ticket reference. */
    ticketRef: 'Ticket',
    downloadPdf: 'Download PDF',
    appleWallet: 'Add to Apple Wallet',
    googleWallet: 'Add to Google Wallet',
    /** Carries `{uuid}`. Alt text on the scannable code. */
    qrAlt: 'QR code for ticket {uuid}',
  },

  login: {
    title: 'My Account',
    lead: 'Enter your email to receive a magic sign-in link.',
    email: 'Email address',
    sending: 'Sending…',
    send: 'Send magic link',
    failed: 'Something went wrong.',
    sentTitle: 'Check your email',
    sentBody: 'We sent a magic link to your email address.',
    devMode: 'Dev mode:',
    devSignIn: 'Click here to sign in',
    linkInvalid: 'Sign-in link invalid or expired. Please request a new one.',
  },

  orders: {
    loading: 'Loading orders…',
    loadFailed: 'Failed to load orders.',
    empty: 'No orders yet.',
    pdf: 'PDF',
  },

  claim: {
    claiming: 'Claiming your ticket…',
    claimed: 'Ticket claimed!',
    newUuid: 'Your new ticket UUID:',
    alreadyTitle: 'Already claimed',
    alreadyBody: 'This transfer link has already been used.',
    expiredTitle: 'Transfer expired',
    expiredBody: 'This claim link has expired. Please ask the sender to initiate a new transfer.',
    invalidTitle: 'Invalid link',
    invalidBody: 'This claim link is not valid.',
    errorTitle: 'Something went wrong',
    errorBody: 'Please try again later.',
  },
}
