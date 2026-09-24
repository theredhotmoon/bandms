import type { StagePlotItemType } from '../types/instrumentType'
import type { SignalChainType, BacklineCategory, WirelessType, MicDiChoice } from '../types/rig'

/**
 * Every word `RiderSheet.vue` prints.
 *
 * The sheet takes this as a **required** prop and holds no strings of its own,
 * so a consumer cannot render it without deciding what language the document
 * is in. That is the same reasoning as the component's fixed styling: it is a
 * printed document, and what it says has to be a deliberate choice at the call
 * site rather than whatever the library happened to hardcode.
 *
 * It deliberately does **not** live in `@bandms/site-copy`. These are not band
 * copy — no band will ever want to edit "Ch" or "STAGE BACK" — and putting
 * ~150 of them in the registry would bury the three genuinely editable rider
 * fields behind a wall of inputs in `/admin/website-modules`. They also have
 * to be identical in both apps; two registries holding the same 150 strings is
 * the drift this package exists to prevent.
 *
 * Adding a field here is a compile error at both call sites. That is the
 * point — a new string on the sheet must be answered in every language before
 * it can ship, which nothing else in the build would enforce.
 */
export interface RiderSheetLabels {
  /** Screen-only bar above the document; never printed. */
  readonly toolbar: {
    readonly badge: string
    readonly print: string
  }

  readonly cover: {
    /** Also the footer line and the browser-side document title. */
    readonly title: string
    /** Alt text on the band's logo above the cover title. */
    readonly logoAlt: string
    readonly musicians: string
    readonly totalInputs: string
    readonly status: string
    readonly active: string
    readonly draft: string
  }

  readonly stage: {
    readonly title: string
    /** Printed inside the SVG — kept short, it has ~700px of stage width. */
    readonly back: string
    readonly audience: string
    readonly guest: string
  }

  readonly musicians: {
    readonly title: string
    readonly complete: string
    readonly incomplete: string
    readonly signalChain: string
    readonly noInputs: string
    readonly monitors: string
    readonly noMonitors: string
    readonly wireless: string
    readonly backline: string
    readonly power: string
    readonly fohNotes: string
    readonly item: string
    readonly outletsNeeded: string
  }

  readonly inputs: {
    readonly title: string
  }

  readonly monitorSummary: {
    readonly title: string
    readonly wedge: string
    readonly iem: string
  }

  readonly wirelessRegistry: {
    readonly title: string
  }

  readonly backline: {
    readonly title: string
  }

  readonly paFoh: {
    readonly title: string
    readonly roomCoverage: string
    readonly subwoofer: string
    readonly processing: string
    readonly consolePreference: string
    readonly engineer: string
    readonly ownEngineer: string
    readonly showFile: string
    /** Carries `{format}`. */
    readonly showFileValue: string
    readonly tbd: string
  }

  readonly power: {
    readonly title: string
    readonly cleanPower: string
  }

  /**
   * Column headings and field names, shared across the per-musician blocks and
   * the consolidated tables. One entry per distinct word — "Notes" heads six
   * different tables and is one string, not six.
   */
  readonly columns: {
    readonly channel: string
    readonly source: string
    readonly micDi: string
    readonly model: string
    readonly stand: string
    readonly notes: string
    readonly type: string
    readonly label: string
    readonly config: string
    readonly mixDescription: string
    readonly iemModel: string
    readonly frequency: string
    readonly musician: string
    readonly musicianUnit: string
    readonly musicianItem: string
    readonly locationMusician: string
    readonly brandModel: string
    readonly freqBand: string
    readonly own: string
    readonly ownUnit: string
    readonly category: string
    readonly brandPreference: string
    readonly specs: string
    readonly outlets: string
  }

  readonly common: {
    readonly yes: string
    readonly no: string
    /** Stands in for an empty cell. */
    readonly none: string
    /** A lineup guest with no name on record. */
    readonly guest: string
    /** Carries `{id}` — a placement pointing at a member who is not in the payload. */
    readonly unknownMember: string
  }

  /** Persisted enum values the sheet prints. Keys are the stored values. */
  readonly chains: Readonly<Record<SignalChainType, string>>
  readonly wirelessTypes: Readonly<Record<WirelessType, string>>
  readonly backlineCategories: Readonly<Record<BacklineCategory, string>>
  readonly micDi: Readonly<Record<MicDiChoice, string>>
  readonly instruments: InstrumentLabels
}

/**
 * Instrument names, keyed by the stored type.
 *
 * Split out because three surfaces need it without needing the rest of the
 * sheet: the admin's stage-plot palette and placement modal, and the shared
 * resolver that turns a placement into a named channel.
 */
export type InstrumentLabels = Readonly<Record<StagePlotItemType, string>>
