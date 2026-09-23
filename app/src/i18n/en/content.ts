export default {
  blocks: {
    title: 'Content blocks',
    empty: 'No blocks yet. Add text, an image, an embed or a reference — they render in this order.',
    remove: 'Remove block',
    danglingRef: '⚠ The item this block referenced was deleted. Pick a new one or remove this block.',
    kind: {
      text: 'Text',
      image: 'Image',
      embed: 'Embed / link',
      ref: 'Reference',
    },
    // The *En / *Pl placeholders are cross-locale on purpose: each hints at
    // content for THAT field, not for the chrome. See shows.ts for the same
    // rule — do not "fix" them to match the surrounding locale.
    text: {
      placeholderEn: 'Paragraph text…',
      placeholderPl: 'Treść akapitu…',
    },
    image: {
      uploadFailed: 'Image upload failed',
      remove: 'Remove image',
      uploading: 'Uploading…',
      upload: 'Click to upload an image',
      altEn: 'Alt text (describes the image)',
      altPl: 'Tekst alternatywny',
      captionEn: 'Caption (optional)',
      captionPl: 'Podpis',
    },
    embed: {
      urlPlaceholder: 'Paste a video (YouTube, Vimeo, Instagram, TikTok, Facebook) or audio (Spotify, SoundCloud, Apple Music) URL',
      audioPrefix: 'Audio · ',
      linkTextEn: 'Link text (optional)',
      linkTextPl: 'Tekst linku (opcjonalnie)',
    },
    ref: {
      entity: {
        concert: 'Concert',
        album: 'Photo album',
        release: 'Release',
        video: 'Music video',
        press: 'Press coverage',
        shop: 'Shop item',
        clip: 'Clip',
      },
      clipAdded: 'Clip added to the library',
      chooseItem: 'Choose an item…',
      chooseClip: 'Choose a clip…',
      addNewClip: '＋ Add a new clip…',
      noConcert: 'No concert',
      attach: 'Attach',
    },
  },
}
