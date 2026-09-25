/**
 * The "More" nav group: shop, bands, tags, instruments, users.
 *
 * A grab-bag by navigation rather than by subject, which is why the sub-objects
 * here have less in common than in the other areas. Filled in across slices
 * 6b–6d; each screen owns one key.
 */
export default {
  shop: {
    title: 'Shop',
    categories: 'Categories',
    currencies: 'Currencies',
    addItem: '+ Add item',
    loadFailed: 'Failed to load shop items.',
    empty: 'No items yet. Add the first one above.',
    noMatch: 'No items match your search.',
    loadingItem: 'Loading item…',

    modalNew: 'New shop item',
    modalEdit: 'Edit item',
    created: 'Item created',
    updated: 'Item updated',
    deleted: 'Item deleted',
    deleteConfirm: 'This item and all its photos will be permanently deleted.',
    orderSaved: 'Order saved',
    orderFailed: 'Failed to save order',
    photosUploaded: '{n} photo uploaded | {n} photos uploaded',
    uploadFailed: 'Upload failed',
    photoDeleteFailed: 'Failed to delete photo',
    categoryCreated: 'Category created',
    categoryUpdated: 'Category updated',
    categoryDeleted: 'Category deleted',
    currenciesSaved: 'Currencies saved',
    currenciesFailed: 'Failed to save currencies',
    optional: 'Optional',

    /** Persisted `ShopItemType` values, keyed by the stored value. */
    types: {
      record: 'Record',
      apparel: 'Apparel',
      accessory: 'Accessory',
      ticket: 'Ticket',
      bundle: 'Bundle',
      other: 'Other',
    },

    cols: {
      photo: 'Photo',
      name: 'Name',
      type: 'Type',
      price: 'Price',
      status: 'Status',
      stock: 'Stock',
      categories: 'Categories',
      actions: 'Actions',
    },

    status: {
      preSale: 'Pre-sale',
      available: 'Available',
      hidden: 'Hidden',
    },

    photos: {
      title: 'Photos',
      empty: 'No photos yet.',
      saveOrder: 'Save order',
      add: 'Add photos',
      uploading: 'Uploading…',
      choose: 'Choose photos',
    },

    cats: {
      modalTitle: 'Shop categories',
      empty: 'No categories yet. Create one below.',
      editTitle: 'Edit category',
      newTitle: 'New category',
      name: 'Name *',
      namePlaceholder: 'e.g. Limited Editions',
      description: 'Description',
      sortOrder: 'Sort order',
      startNew: 'New',
      saveChanges: 'Save changes',
    },

    currency: {
      modalTitle: 'Shop currencies',
      lead: 'Set the currencies available for pricing. Items will show a price field for each enabled currency.',
      empty: 'No currencies added yet.',
    },

    form: {
      info: 'Info',
      name: 'Name *',
      namePlaceholder: 'e.g. Debut LP — Limited Edition',
      slug: 'Slug URL',
      categories: 'Categories',
      noCategories: 'No categories yet. Add some via the Categories button.',
      description: 'Description',
      descriptionPlaceholder: 'Describe the item…',
      pricing: 'Pricing',
      noCurrencies: 'No currencies configured. Set up currencies in Band Profile → Shop Settings first.',
      /** Carries `{currency}` — the ISO code of the price field beside it. */
      amountIn: 'Amount in {currency}',
      priceRequired: 'At least one price is required.',
      inventory: 'Inventory',
      stock: 'Stock quantity',
      stockHint: '(leave blank for unlimited)',
      unlimited: 'Unlimited',
      sortOrder: 'Sort order',
      externalUrl: 'External purchase URL',
      availableForSale: 'Available for sale',
      preSale: 'Pre-sale',
      shipsAt: 'Ships at',
      links: 'Links',
      createItem: 'Create item',
      saveChanges: 'Save changes',
    },

    variants: {
      title: 'Variants',
      saveFirst: 'Save the item first to add size/color variants.',
      empty: 'No variants yet. Use the form below to add sizes or colors.',
      name: 'Name',
      value: 'Value',
      stock: 'Stock',
      del: 'Del',
      namePlaceholder: 'Name (e.g. Size)',
      valuePlaceholder: 'Value (e.g. M)',
      /** ∞ is a glyph, not a word — it reads the same in every language. */
      stockPlaceholder: 'Stock (blank=∞)',
    },
  },
}
