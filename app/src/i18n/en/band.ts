export default {
  // Distinct from common.clips, which is the *field* embedded in other forms
  // (AttachedClipsField: "Clips", "Add clip", "Detach clip"). These are the
  // library screen: a page title and a create button with its + prefix. Same
  // English word, different surface — keep them apart so a translator can
  // word the page heading differently from the inline field label.
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
