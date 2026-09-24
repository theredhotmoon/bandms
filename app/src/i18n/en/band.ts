export default {
  // Distinct from common.clips, which is the *field* embedded in other forms
  // (AttachedClipsField: "Clips", "Add clip", "Detach clip"). These are the
  // library screen: a page title and a create button with its + prefix. Same
  // English word, different surface — keep them apart so a translator can
  // word the page heading differently from the inline field label.
  career: {
    levels: {
      l1: {
        name: 'Garage Band',
        tagline: 'Establish your identity — who are you as a band?',
      },
      l2: {
        name: 'Local Band',
        tagline: 'Build your audience — releases, shows, content & first press',
      },
      l3: {
        name: 'Pro Band',
        tagline: 'Establish your industry presence — EPK, agents, sync, media',
      },
      l4: {
        name: 'Custom',
        tagline: 'Define your own goals — personalised checklist for your band',
      },
    },
    sections: {
      identity: 'Identity',
      band: 'Band',
      firstMusic: 'First Music',
      onlinePresence: 'Online Presence',
      releasesMusic: 'Releases & Music',
      liveActivity: 'Live Activity',
      contentPress: 'Content & Press',
      discovery: 'Discovery',
      ePKPromo: 'EPK & Promo',
      contactsIndustry: 'Contacts & Industry',
      reach: 'Reach',
      content: 'Content',
      yourGoals: 'Your Goals',
    },
    items: {
      nameBio: {
        label: 'Band name & short bio',
        tip: 'Fill in your name and at least a 280-char short bio',
      },
      hometown: {
        label: 'Hometown & formation year',
        tip: 'Venues and press always ask where you are from',
      },
      genres: {
        label: 'Genre tags set',
        tip: 'Tag your genre so fans and algorithms can find you',
      },
      members: {
        label: 'At least 2 band members listed',
        tip: 'Add member profiles so booking agents know your lineup',
      },
      firstRelease: {
        label: 'First release uploaded',
        tip: 'Upload your first album, EP or single',
      },
      coverArt: {
        label: 'Cover artwork on a release',
        tip: 'Streaming platforms require cover art',
      },
      socialLinks: {
        label: '2+ social media links',
        tip: 'Instagram, Spotify, YouTube — minimum 2 platforms',
      },
      bookingEmail: {
        label: 'Booking contact email',
        tip: 'Direct email — not a social handle or contact form',
      },
      multiReleases: {
        label: '3+ releases in catalogue',
        tip: 'Build a back-catalogue fans can discover',
      },
      musicVideo: {
        label: 'Music video added',
        tip: '"Live video is non-negotiable" — EPK checklist 2026',
      },
      concerts: {
        label: '3+ concerts on record',
        tip: 'Build a show history for your EPK and booking pitches',
      },
      upcomingShow: {
        label: 'Upcoming show listed',
        tip: 'Active touring artists book more shows',
      },
      firstPress: {
        label: 'First press article / feature',
        tip: 'Any blog post, review or interview that mentions you',
      },
      newsPosts: {
        label: '3+ news posts published',
        tip: 'Regular content signals an active band to Google and fans',
      },
      bioVariants: {
        label: 'Short & medium bio written',
        tip: 'Booking agents copy-paste the short bio into listings',
      },
      comparable: {
        label: 'Comparable artists set',
        tip: '"For fans of X" is the most-read line on any EPK',
      },
      fullEpk: {
        label: 'Full EPK published (versioned)',
        tip: 'Create and publish a versioned EPK snapshot',
      },
      featuredRelease: {
        label: 'Featured release set on EPK',
        tip: 'Choose your best release to headline the EPK',
      },
      techRider: {
        label: 'Active tech rider built',
        tip: 'Professionals judge you by your rider — be specific',
      },
      pressEmail: {
        label: 'Press email set',
        tip: 'Separate press contact for journalists and bloggers',
      },
      techEmail: {
        label: 'Tech contact email set',
        tip: 'Venues need a dedicated tech contact for production',
      },
      tenConcerts: {
        label: '10+ shows on record',
        tip: 'Venues want to see your live history before booking',
      },
      multiPress: {
        label: '3+ press articles / media features',
        tip: 'Media coverage builds credibility for festival applications',
      },
      stats: {
        label: 'Streaming / social stats entered',
        tip: 'Numbers make your EPK scannable in 10 seconds',
      },
      fullBio: {
        label: 'Full bio written (2–3 paragraphs)',
        tip: 'Required for festival programmes and booking agencies',
      },
      statement: {
        label: 'Artistic statement written',
        tip: 'Required for grant applications and premium festival programmers',
      },
    },
    customGoal: {
      label: 'Goal {n} (placeholder)',
      tip: 'Define your own milestone',
    },
  },
  logos: {
    title: 'Logos',
    loading: 'Loading logos…',
    loadFailed: 'Failed to load logos.',
    empty: 'No logos uploaded yet.',
    upload: 'Upload a logo',
    dropzone: 'Drop logo here or click to browse',
    dropzoneHint: 'PNG, JPG, WebP, SVG — max 4 MB',
    uploading: 'Uploading…',
    uploadButton: 'Upload logo',
    badType: 'Unsupported file type. Use PNG, JPG, WebP, or SVG.',
    tooLarge: 'File exceeds 4 MB limit.',
    uploaded: 'Logo uploaded',
    uploadFailed: 'Upload failed',
    updated: 'Logo updated',
    saveFailed: 'Failed to save changes',
    defaultUpdated: 'Default logo updated',
    defaultFailed: 'Failed to set default',
    restored: 'Logo restored',
    deprecatedToast: 'Logo marked as deprecated',
    statusFailed: 'Failed to update status',
    deleted: 'Logo deleted',
    deleteFailed: 'Failed to delete logo',
    label: 'Label',
    labelPlaceholder: 'e.g. Primary full-colour',
    variant: 'Variant',
    background: 'Background',
    versionLabel: 'Version label',
    versionPlaceholder: 'e.g. v2 2024',
    notes: 'Notes',
    notesPlaceholder: 'Internal notes…',
    vector: 'Vector',
    dimensions: '{w} × {h} px',
    badgeDefault: 'DEFAULT',
    badgeDeprecated: 'DEPRECATED',
    alreadyDefault: 'Already default',
    setDefault: 'Set as default',
    isDefault: 'Default',
    restore: 'Restore',
    deprecate: 'Deprecate',
    confirmDelete: 'Delete this logo?',
    confirmYes: 'Yes, delete',
    pinsTitle: 'Context-specific logo overrides',
    pinsHint: 'Each context falls back to the global default when not set.',
    pinEpk: 'EPK logo',
    pinRider: 'Tech Rider logo',
    pinWebsite: 'Website logo',
    useDefault: '— Use default —',
    savePins: 'Save pins',
  },
  clips: {
    title: 'Clips',
    add: '+ Add clip',
    loadFailed: 'Failed to load clips.',
    empty: 'No clips yet.',
    noMatch: 'No clips match your search.',
    created: 'Clip created',
    updated: 'Clip updated',
    deleted: 'Clip deleted',
    modalNew: 'New clip',
    modalEdit: 'Edit clip',
    columns: { category: 'Category', provider: 'Provider', attachedTo: 'Attached to', recorded: 'Recorded' },
  },
}
