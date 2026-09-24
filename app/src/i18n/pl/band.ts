export default {
  // Distinct from common.clips, which is the *field* embedded in other forms
  // (AttachedClipsField: "Clips", "Add clip", "Detach clip"). These are the
  // library screen: a page title and a create button with its + prefix. Same
  // English word, different surface — keep them apart so a translator can
  // word the page heading differently from the inline field label.
  career: {
    levels: {
      l1: {
        name: 'Garażowy zespół',
        tagline: 'Zbuduj swoją tożsamość — kim jesteście jako zespół?',
      },
      l2: {
        name: 'Lokalny zespół',
        tagline: 'Buduj publiczność — wydawnictwa, koncerty, treści i pierwsza prasa',
      },
      l3: {
        name: 'Zespół zawodowy',
        tagline: 'Zbuduj obecność w branży — EPK, agenci, sync, media',
      },
      l4: {
        name: 'Własny',
        tagline: 'Zdefiniuj własne cele — spersonalizowana lista dla Waszego zespołu',
      },
    },
    sections: {
      identity: 'Tożsamość',
      band: 'Zespół',
      firstMusic: 'Pierwsza muzyka',
      onlinePresence: 'Obecność w sieci',
      releasesMusic: 'Wydawnictwa i muzyka',
      liveActivity: 'Aktywność koncertowa',
      contentPress: 'Treści i prasa',
      discovery: 'Odkrywalność',
      ePKPromo: 'EPK i promocja',
      contactsIndustry: 'Kontakty i branża',
      reach: 'Zasięg',
      content: 'Treści',
      yourGoals: 'Wasze cele',
    },
    items: {
      nameBio: {
        label: 'Nazwa zespołu i krótkie bio',
        tip: 'Uzupełnij nazwę i przynajmniej 280-znakowe krótkie bio',
      },
      hometown: {
        label: 'Miasto i rok założenia',
        tip: 'Kluby i media zawsze pytają, skąd jesteście',
      },
      genres: {
        label: 'Ustawione tagi gatunków',
        tip: 'Otaguj gatunek, żeby fani i algorytmy Was znaleźli',
      },
      members: {
        label: 'Co najmniej 2 osoby w składzie',
        tip: 'Dodaj profile muzyków, żeby bookerzy znali Wasz skład',
      },
      firstRelease: {
        label: 'Pierwsze wydawnictwo dodane',
        tip: 'Dodaj pierwszy album, EP-kę lub singiel',
      },
      coverArt: {
        label: 'Okładka przy wydawnictwie',
        tip: 'Serwisy streamingowe wymagają okładki',
      },
      socialLinks: {
        label: 'Co najmniej 2 linki społecznościowe',
        tip: 'Instagram, Spotify, YouTube — minimum 2 platformy',
      },
      bookingEmail: {
        label: 'Adres e-mail do bookingu',
        tip: 'Bezpośredni e-mail — nie profil społecznościowy ani formularz',
      },
      multiReleases: {
        label: 'Co najmniej 3 wydawnictwa w katalogu',
        tip: 'Zbuduj katalog, który fani mogą odkrywać',
      },
      musicVideo: {
        label: 'Dodany teledysk',
        tip: '„Wideo na żywo to podstawa” — lista kontrolna EPK 2026',
      },
      concerts: {
        label: 'Co najmniej 3 koncerty w historii',
        tip: 'Zbuduj historię koncertów do EPK i ofert bookingowych',
      },
      upcomingShow: {
        label: 'Nadchodzący koncert na liście',
        tip: 'Aktywnie koncertujący artyści dostają więcej zagrań',
      },
      firstPress: {
        label: 'Pierwszy artykuł lub materiał prasowy',
        tip: 'Dowolny wpis, recenzja lub wywiad, który Was wspomina',
      },
      newsPosts: {
        label: 'Co najmniej 3 opublikowane aktualności',
        tip: 'Regularne treści pokazują Google i fanom, że zespół żyje',
      },
      bioVariants: {
        label: 'Krótkie i średnie bio napisane',
        tip: 'Bookerzy kopiują krótkie bio prosto do zapowiedzi',
      },
      comparable: {
        label: 'Ustawieni podobni artyści',
        tip: '„Dla fanów X” to najczęściej czytany wiersz w każdym EPK',
      },
      fullEpk: {
        label: 'Pełne EPK opublikowane (z wersjonowaniem)',
        tip: 'Utwórz i opublikuj wersjonowaną migawkę EPK',
      },
      featuredRelease: {
        label: 'Wyróżnione wydawnictwo w EPK',
        tip: 'Wybierz najlepsze wydawnictwo na otwarcie EPK',
      },
      techRider: {
        label: 'Aktywny rider techniczny',
        tip: 'Profesjonaliści oceniają Was po riderze — bądźcie konkretni',
      },
      pressEmail: {
        label: 'Ustawiony e-mail prasowy',
        tip: 'Osobny kontakt dla dziennikarzy i blogerów',
      },
      techEmail: {
        label: 'Ustawiony e-mail techniczny',
        tip: 'Kluby potrzebują dedykowanego kontaktu do produkcji',
      },
      tenConcerts: {
        label: 'Co najmniej 10 koncertów w historii',
        tip: 'Kluby chcą zobaczyć historię koncertów przed bookingiem',
      },
      multiPress: {
        label: 'Co najmniej 3 artykuły lub materiały w mediach',
        tip: 'Obecność w mediach buduje wiarygodność przy aplikacjach festiwalowych',
      },
      stats: {
        label: 'Wprowadzone statystyki streamingu i social mediów',
        tip: 'Liczby sprawiają, że EPK da się ogarnąć w 10 sekund',
      },
      fullBio: {
        label: 'Pełne bio napisane (2–3 akapity)',
        tip: 'Wymagane w programach festiwali i agencjach bookingowych',
      },
      statement: {
        label: 'Napisany manifest artystyczny',
        tip: 'Wymagany przy wnioskach grantowych i w programach dużych festiwali',
      },
    },
    customGoal: {
      label: 'Cel {n} (placeholder)',
      tip: 'Zdefiniuj własny kamień milowy',
    },
  },
  logos: {
    title: 'Logotypy',
    loading: 'Wczytywanie logotypów…',
    loadFailed: 'Nie udało się wczytać logotypów.',
    empty: 'Nie dodano jeszcze żadnego logotypu.',
    upload: 'Prześlij logotyp',
    dropzone: 'Upuść logotyp tutaj lub kliknij, aby wybrać',
    dropzoneHint: 'PNG, JPG, WebP, SVG — maks. 4 MB',
    uploading: 'Przesyłanie…',
    uploadButton: 'Prześlij logotyp',
    badType: 'Nieobsługiwany typ pliku. Użyj PNG, JPG, WebP lub SVG.',
    tooLarge: 'Plik przekracza limit 4 MB.',
    uploaded: 'Logotyp przesłany',
    uploadFailed: 'Przesyłanie nie powiodło się',
    updated: 'Logotyp zaktualizowany',
    saveFailed: 'Nie udało się zapisać zmian',
    defaultUpdated: 'Domyślny logotyp zaktualizowany',
    defaultFailed: 'Nie udało się ustawić domyślnego',
    restored: 'Logotyp przywrócony',
    deprecatedToast: 'Logotyp oznaczony jako wycofany',
    statusFailed: 'Nie udało się zmienić statusu',
    deleted: 'Logotyp usunięty',
    deleteFailed: 'Nie udało się usunąć logotypu',
    label: 'Etykieta',
    labelPlaceholder: 'np. Podstawowy pełnokolorowy',
    variant: 'Wariant',
    background: 'Tło',
    versionLabel: 'Etykieta wersji',
    versionPlaceholder: 'np. v2 2024',
    notes: 'Notatki',
    notesPlaceholder: 'Notatki wewnętrzne…',
    vector: 'Wektor',
    dimensions: '{w} × {h} px',
    badgeDefault: 'DOMYŚLNY',
    badgeDeprecated: 'WYCOFANY',
    alreadyDefault: 'Już domyślny',
    setDefault: 'Ustaw jako domyślny',
    isDefault: 'Domyślny',
    restore: 'Przywróć',
    deprecate: 'Wycofaj',
    confirmDelete: 'Usunąć ten logotyp?',
    confirmYes: 'Tak, usuń',
    pinsTitle: 'Logotypy przypisane do kontekstów',
    pinsHint: 'Każdy kontekst używa globalnego domyślnego, dopóki nie zostanie ustawiony.',
    pinEpk: 'Logotyp EPK',
    pinRider: 'Logotyp ridera',
    pinWebsite: 'Logotyp strony',
    useDefault: '— Użyj domyślnego —',
    savePins: 'Zapisz przypisania',
  },
  clips: {
    title: 'Klipy',
    add: '+ Dodaj klip',
    loadFailed: 'Nie udało się wczytać klipów.',
    empty: 'Brak klipów.',
    noMatch: 'Żaden klip nie pasuje do wyszukiwania.',
    created: 'Klip utworzony',
    updated: 'Klip zaktualizowany',
    deleted: 'Klip usunięty',
    modalNew: 'Nowy klip',
    modalEdit: 'Edytuj klip',
    columns: { category: 'Kategoria', provider: 'Serwis', attachedTo: 'Przypisany do', recorded: 'Nagrano' },
  },
}
