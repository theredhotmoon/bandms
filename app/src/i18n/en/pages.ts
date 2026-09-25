/**
 * The Page Configuration nav group: website modules, hero images and FAQs.
 *
 * These three screens configure what the *public* site shows rather than what
 * it contains, which is why they sit apart from the content areas. Every one
 * of them ends in "…after a rebuild", because none of it reaches a visitor
 * until the static build runs again.
 */
export default {
  modules: {
    title: 'Website Modules',
    lead: 'Drag rows to set the nav order. Order takes effect after a rebuild.',
    loadFailed: 'Failed to load modules. Check the API connection.',
    saveFailed: 'Could not save the module',
    live: 'Live',
    off: 'Off',
    enabled: 'Enabled',
    disabled: 'Disabled',
    /** Carries `{name}` — the module's display name. */
    editSettings: 'Edit {name} settings',
    customName: 'Custom name',
    chromeNote: 'This module is site chrome, not a page — it has no URL. Switching it off hides it from the public site.',
    urlSlug: 'URL slug',
    // `{path}` is a <code> element, so this is an <i18n-t> keypath rather than
    // a parameter — a slot renders markup, an interpolation escapes it.
    slugHint: 'Lowercase letters, numbers and dashes. Leave empty to serve under {path}. Changing this moves the page — old links stop working.',
    pageCopy: 'Page copy',
    pageCopyHint: 'The greyed text in each box is what the site shows now. Type to replace it; leaving a box empty keeps the default for that language. Where there is no default at all, the other language’s text is used. Changes appear on the public site after a rebuild.',
    visibility: 'Section visibility',
    rebuildNote: 'Changes appear on the public site after a rebuild.',
    perPage: 'Items per page',
    perPageDefault: 'Default',
  },

  heroImages: {
    title: 'Hero Images',
    lead: 'Pictures shown behind a page’s title. With more than one active picture, one is chosen at random on each visit. A page with none of its own uses Main. Uploaded here directly — never from the photo gallery.',
    loadFailed: 'Could not load hero images.',
    empty: 'No pictures yet.',
    usesMain: 'This page uses the Main set.',
    noFile: 'no file',
    caption: 'Caption (optional)',
    moveEarlier: 'Move earlier',
    moveLater: 'Move later',
    active: 'Active',
    remove: 'Remove',
    uploading: 'Uploading…',
    upload: '+ Upload pictures',
    rebuildNote: 'The public site is static — hero changes appear after a rebuild.',
    // Scope list
    scopeMain: 'Main',
    scopeMainHint: 'Used by every page that has none of its own',
    scopeHome: 'Homepage',
    scopeOffHint: 'module currently switched off',
    // Summaries beside each scope
    noneSet: 'none set',
    inheritsMain: 'inherits Main',
    pictureCount: '{n} picture | {n} pictures',
    uploaded: '{n} picture uploaded | {n} pictures uploaded',
    uploadFailed: 'Upload failed',
    captionFailed: 'Could not save caption',
    updateFailed: 'Could not update',
    reorderFailed: 'Could not reorder',
    removed: 'Picture removed',
    removeFailed: 'Could not remove picture',
  },

  faqs: {
    title: 'FAQ',
    lead: 'Questions are grouped by the subpage they appear on. A page with no questions shows no FAQ block at all.',
    add: '+ Add question',
    loadFailed: 'Failed to load questions. Check the API connection.',
    newQuestion: 'New question',
    emptyGroup: 'No questions for this subpage yet. Add one and it will appear in an FAQ block at the bottom of that page.',
    untitled: '(untitled)',
    noPl: 'No Polish translation',
    noEn: 'No English translation',
    live: 'Live',
    draft: 'Draft',
    hideFromSite: 'Hide from the public site',
    showOnSite: 'Show on the public site',
    /** Both carry `{n}` — the row's position, which is what the icons sit beside. */
    editQuestion: 'Edit question {n}',
    deleteQuestion: 'Delete question {n}',
    added: 'Question added',
    saved: 'Question saved',
    saveFailed: 'Could not save the question',
    /** Stands in for the question when it has no text in either language. */
    thisQuestion: 'this question',
    /** Carries `{title}`. */
    deleteAsk: 'Delete “{title}”? This cannot be undone.',
    deleted: 'Question deleted',
    deleteFailed: 'Could not delete the question',
    // Editor
    /** Marks a subpage whose module is switched off, in the picker. */
    moduleOff: '(off)',
    subpage: 'Subpage',
    published: 'Published',
    question: 'Question',
    answer: 'Answer',
    editorHint: 'A question with only one language filled in still shows on the other — the public site falls back rather than rendering an empty row. Changes appear after a rebuild.',
  },

  /**
   * MODULE_VISIBILITY_SCHEMA's labels, keyed by `<module>.<field>`.
   *
   * They live here rather than in config/moduleSettings.ts because they are
   * form copy, not shape — the schema keeps the keys and the default, this
   * keeps the words.
   */
  visibility: {
    about: {
      show_stats: 'Band in numbers',
      show_stats_help: 'The stats grid (monthly listeners, shows played, years on stage…) on the public About page. Still hidden automatically when there is nothing to show.',
      show_members: 'Band members',
      show_members_help: 'The line-up grid on the public About page.',
    },
  },
}
