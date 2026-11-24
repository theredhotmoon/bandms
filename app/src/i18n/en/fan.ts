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
    passwordSet: 'Your password is set. You can now sign in with it.',
    setPassword: 'Set a password',
    changePassword: 'Change password',
    passwordLead: 'Add a password to sign in without waiting for an email.',
    currentPassword: 'Current password',
    newPassword: 'New password',
    savePassword: 'Save password',
    saving: 'Saving…',
    passwordSaved: 'Password saved.',
    passwordFailed: 'Could not save the password.',
    optionsLoading: 'Loading…',
    optionsLoadFailed: 'Could not load your sign-in options.',
    retry: 'Try again',
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
    lead: 'Sign in with your email and password, or get a sign-in link by email.',
    password: 'Password',
    passwordHint: 'At least 8 characters.',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    createAccount: 'Create an account',
    createSubmit: 'Create account',
    creating: 'Creating account…',
    backToSignIn: 'Back to sign in',
    registerSent: 'Almost done. We emailed you a link; open it to confirm your address and finish creating the account.',
    title: 'My Account',
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
