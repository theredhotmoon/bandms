export default {
  blocks: {
    title: 'Bloki treści',
    empty: 'Brak bloków. Dodaj tekst, zdjęcie, osadzenie lub odnośnik — wyświetlą się w tej kolejności.',
    remove: 'Usuń blok',
    danglingRef: '⚠ Element, do którego odwoływał się ten blok, został usunięty. Wybierz nowy lub usuń blok.',
    kind: {
      text: 'Tekst',
      image: 'Zdjęcie',
      embed: 'Osadzenie / link',
      ref: 'Odnośnik',
    },
    // The *En / *Pl placeholders are cross-locale on purpose: each hints at
    // content for THAT field, not for the chrome. See shows.ts for the same
    // rule — do not "fix" them to match the surrounding locale.
    text: {
      placeholderEn: 'Paragraph text…',
      placeholderPl: 'Treść akapitu…',
    },
    image: {
      uploadFailed: 'Nie udało się przesłać zdjęcia',
      remove: 'Usuń zdjęcie',
      uploading: 'Przesyłanie…',
      upload: 'Kliknij, aby przesłać zdjęcie',
      altEn: 'Alt text (describes the image)',
      altPl: 'Tekst alternatywny',
      captionEn: 'Caption (optional)',
      captionPl: 'Podpis',
    },
    embed: {
      urlPlaceholder: 'Wklej adres wideo (YouTube, Vimeo, Instagram, TikTok, Facebook) lub audio (Spotify, SoundCloud, Apple Music)',
      audioLabel: 'Audio · {provider}',
      linkTextEn: 'Link text (optional)',
      linkTextPl: 'Tekst linku (opcjonalnie)',
    },
    ref: {
      entity: {
        concert: 'Koncert',
        album: 'Album ze zdjęciami',
        release: 'Wydawnictwo',
        video: 'Teledysk',
        press: 'Materiał prasowy',
        shop: 'Produkt w sklepie',
        clip: 'Klip',
      },
      clipAdded: 'Klip dodany do biblioteki',
      chooseItem: 'Wybierz element…',
      chooseClip: 'Wybierz klip…',
      addNewClip: '＋ Dodaj nowy klip…',
      noConcert: 'Brak koncertu',
      attach: 'Dołącz',
    },
  },
}
