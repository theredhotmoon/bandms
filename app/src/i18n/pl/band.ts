export default {
  // Distinct from common.clips, which is the *field* embedded in other forms
  // (AttachedClipsField: "Clips", "Add clip", "Detach clip"). These are the
  // library screen: a page title and a create button with its + prefix. Same
  // English word, different surface — keep them apart so a translator can
  // word the page heading differently from the inline field label.
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
