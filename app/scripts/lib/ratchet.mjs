/**
 * The i18n ratchet: paths already migrated, relative to app/src.
 * Extend this in every area PR.
 *
 * A data module, imported by all four guards, because the alternative was
 * parsing a JavaScript array out of a JavaScript file — and four attempts at
 * that parse failed, every one of them silently:
 *
 *   1. a regex requiring a file extension dropped the four *directory* entries,
 *      so the ten files under them were treated as unmigrated while the string
 *      lint called them done — the two guards contradicting each other out loud;
 *   2. matching quotes with a regex desynchronised on an apostrophe in a comment;
 *   3. stripping comments after bracket-matching let a `]` in a comment end the
 *      array early;
 *   4. a scanner that consumed double-quoted strings but collected only
 *      single-quoted ones, so one Prettier run with `singleQuote: false` would
 *      have dropped entries — and that one failed *open*.
 *
 * An import has none of those failure modes, and it is what the consumers were
 * always able to do. The list no longer sits beside the lint that grew it; that
 * is the whole cost.
 *
 * Five files were listed here *and* covered by a directory entry above them —
 * leftovers from the months the parser was dropping those directory entries, so
 * an individual listing was the only thing that worked. ratchet.spec.ts fails on
 * a redundant entry now, which is only meaningful because the list is finally
 * read correctly.
 */
export const MIGRATED = [
  'App.vue',
  'components/admin/AdminLayout.vue',
  'components/admin/AdminModal.vue',
  'components/admin/ConfirmDialog.vue',
  'components/admin/EpkVersionHistory.vue',
  'components/admin/Pagination.vue',
  'components/admin/RebuildBar.vue',
  'components/admin/RebuildSettingsModal.vue',
  'components/admin/SortHeader.vue',
  'components/admin/forms/AuthorForm.vue',
  'components/admin/forms/PostForm.vue',
  'components/admin/forms/PressReleaseForm.vue',
  'components/admin/forms/ClipCategoryPicker.vue',
  'components/admin/forms/SlugInput.vue',
  'components/admin/forms/AttachedClipsField.vue',
  'components/admin/forms/SocialLinksEditor.vue',
  'components/admin/RichEditor.vue',
  'components/admin/TableToolbar.vue',
  'components/admin/TicketStatusBadge.vue',
  'components/admin/UiLangSwitcher.vue',
  'components/auth/SignInForm.vue',
  'composables/useEpkVersionHistory.ts',
  'components/admin/ConcertTicketsManager.vue',
  'components/admin/forms/ConcertForm.vue',
  'components/admin/forms/TourForm.vue',
  'components/admin/forms/VenueForm.vue',
  'views/admin/ConcertTicketListView.vue',
  'views/admin/ConcertsAdminView.vue',
  'views/admin/DoorCheckView.vue',
  'views/admin/ToursAdminView.vue',
  'views/admin/VenuesAdminView.vue',
  'components/admin/forms/PostBlockEditor.vue',
  'components/admin/forms/blocks',
  'views/admin/AuthorsAdminView.vue',
  'views/admin/NewsletterAdminView.vue',
  'views/admin/PostsAdminView.vue',
  'views/admin/PressReleasesAdminView.vue',
  'views/admin/PitchGeneratorView.vue',
  'views/admin/ClipsAdminView.vue',
  'components/admin/BandLogoManager.vue',
  'components/admin/CareerLevelWidget.vue',
  'components/admin/forms/AboutBioVariantSelect.vue',
  'components/admin/EntityRelationsPanel.vue',
  'components/admin/forms/SingleImageUpload.vue',
  'components/admin/forms/ClipForm.vue',
  'components/AppNavbar.vue',
  'components/rig',
  'views/admin/BandMembersAdminView.vue',
  'views/admin/MyProfileView.vue',
  'views/admin/MySetupsView.vue',
  'components/admin/forms/BandMemberForm.vue',
  'components/band-member',
  'views/admin/ReleasesAdminView.vue',
  'components/admin/forms/ReleaseForm.vue',
  'components/admin/forms/ImageDropZone.vue',
  'views/admin/PhotosAdminView.vue',
  'views/admin/SetlistsAdminView.vue',
  'components/setlist',
  'components/ui/InstrumentIconPicker.vue',
  'components/tech-rider/TechRiderStagePlot.vue',
  'components/tech-rider/PlacementModal.vue',
  'components/tech-rider/StagePlotMemberSelector.vue',
  'components/tech-rider/RiderRequirements.vue',
  'components/tech-rider/RiderSourceBadge.vue',
  'components/tech-rider/RiderChannelList.vue',
  'components/tech-rider/RiderConfirmations.vue',
  'components/tech-rider/RiderPublishModal.vue',
  'components/tech-rider/RiderVersionHistory.vue',
  'components/tech-rider/TechRiderCompleteness.vue',
  'components/tech-rider/TechRiderCover.vue',
  'components/tech-rider/TechRiderPaFoh.vue',
  'components/tech-rider/TechRiderSidebar.vue',
  'views/admin/TechRiderAdminView.vue',
  'views/admin/WebsiteModulesView.vue',
  'views/admin/HeroImagesAdminView.vue',
  'views/admin/ShopAdminView.vue',
  'views/admin/UsersAdminView.vue',
  'views/admin/TagsAdminView.vue',
  'views/admin/InstrumentsAdminView.vue',
  'views/admin/BandsAdminView.vue',
  'components/admin/forms/BandForm.vue',
  'views/admin/FanAccountsAdminView.vue',
  'components/admin/forms/TagForm.vue',
  'components/admin/forms/ShopItemForm.vue',
  'views/admin/FaqsAdminView.vue',
  'components/admin/FaqEditor.vue',
  'config/moduleSettings.ts',
  'views/TechRiderPreviewView.vue',
  'views/admin/MusicVideosAdminView.vue',
  'components/admin/forms/BatchPhotoUpload.vue',
  'composables/useTechRiderEditor.ts',
  'utils/documentTitle.ts',
  'composables/useTechRiderVersions.ts',
  'utils/riderDiff.ts',
  'views/admin/BandCalendarView.vue',
  'views/FanAccountView.vue',
  'views/TicketClaimView.vue',
  'components/TicketDownloadCard.vue',
  'components/fan/FanTicketsList.vue',
  'components/fan/FanLoginForm.vue',
  'components/fan/FanMagicLinkSent.vue',
  'components/fan/FanOrdersList.vue',
  'views/admin/BandProfileAdminView.vue',
  'views/admin/AdminDashboard.vue',
  'views/admin/AdminEntry.vue',

  // On the ratchet with line-level `i18n-ignore` rather than exempted whole-file
  // in check-i18n-complete.mjs. A whole-file exemption took them out of all four
  // guards: the coverage guard's import walk only follows `.vue` specifiers, so
  // a `meta: { title: 'Dashboard' }` added to the router, or a second label map
  // added to postBlocks.ts, would have been invisible to every one of them.
  'router/index.ts',
  'utils/postBlocks.ts',
  'composables/useConcertTickets.ts',
]

/** A path is on the ratchet directly, or under a directory entry. */
export function coveredBy(paths) {
  return (rel) => paths.some((m) => rel === m || rel.startsWith(m + '/'))
}

/**
 * Is this a file the guards should read?
 *
 * `.vue` and `.ts`, never `.spec.ts`. Specs are excluded because the only
 * remedy these lints can offer is "move the text into the i18n catalogue",
 * which is nonsense for a test assertion — check-i18n-coverage documents the
 * unescapable loop it creates. check-admin-strings disagreed until recently:
 * its directory entries pulled specs in, so the one thing the four guards were
 * meant to share, they did not.
 */
export function isScannable(path) {
  return path.endsWith('.vue') || (path.endsWith('.ts') && !path.endsWith('.spec.ts'))
}
