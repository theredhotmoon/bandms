/**
 * riderDiff.ts
 *
 * What changed between two published versions of a rider.
 *
 * Diffing happens on the *resolved* rider, not on the stored one. A promoter
 * does not care that a placement gained an override; they care that channel 11
 * became a DI and that monitor 3 turned into an IEM. Resolving both snapshots
 * first — with the same @bandms/rider-core resolver every other surface uses — means
 * this reads the same document the venue reads.
 *
 * Rows are matched by their resolved `key` (`placementId:rowId`), which is
 * stable across versions because placement ids and row ids outlive edits. That
 * is what lets a row be reported as *changed* rather than as one removal and
 * one unrelated addition.
 *
 * Pure functions only — no Vue, no fetching.
 */

import type { SetupLookup } from '@bandms/rider-core'
import type { ResolverLabels, InstrumentLabels } from '@bandms/rider-core'
import { EN_RESOLVER_LABELS } from '@bandms/rider-core'
import type { PublishedRider } from '@bandms/rider-core'
import { resolveRider } from '@bandms/rider-core'
import type { ResolvedRider } from '@bandms/rider-core'

export type ChangeKind = 'added' | 'removed' | 'changed'

export interface DiffEntry {
  kind: ChangeKind
  /** The row as the engineer names it — "11 · Gtr L", "Marek — Wedge". */
  label: string
  /** Who it belongs to, for grouping in the UI. */
  source: string
  /** Field-level detail, only on `changed`: "mic_di: DI → Mic+DI". */
  changes: string[]
}

export interface RiderDiffSection {
  title: string
  entries: DiffEntry[]
}

export interface RiderDiff {
  from: number
  to: number
  sections: RiderDiffSection[]
  /** "+2 channels · 1 monitor changed · −1 backline item", or "" when identical. */
  summary: string
  identical: boolean
}

// ── Comparing one list ────────────────────────────────────────────────────────

interface Row {
  key: string
  label: string
  source: string
  /** The fields that are worth reporting a change in, already stringified. */
  fields: Record<string, string>
}

function diffRows(before: Row[], after: Row[], t: DiffTranslator): DiffEntry[] {
  const beforeByKey = new Map(before.map((r) => [r.key, r]))
  const afterByKey = new Map(after.map((r) => [r.key, r]))
  const entries: DiffEntry[] = []

  // `after` order, so the list reads in the order the new rider prints.
  for (const row of after) {
    const old = beforeByKey.get(row.key)

    if (!old) {
      entries.push({ kind: 'added', label: row.label, source: row.source, changes: [] })
      continue
    }

    const changes = Object.keys(row.fields)
      .filter((field) => old.fields[field] !== row.fields[field])
      .map((field) => `${t(`rider.diff.fields.${field}`)}: ${old.fields[field] || '—'} → ${row.fields[field] || '—'}`)

    if (changes.length) {
      entries.push({ kind: 'changed', label: row.label, source: row.source, changes })
    }
  }

  for (const row of before) {
    if (!afterByKey.has(row.key)) {
      entries.push({ kind: 'removed', label: row.label, source: row.source, changes: [] })
    }
  }

  return entries
}

// ── Turning a resolved rider into comparable rows ─────────────────────────────

function channelRows(rider: ResolvedRider, t: DiffTranslator): Row[] {
  return rider.inputs.map((row) => ({
    key: row.key,
    label: `${row.channel} · ${row.instrument || t('rider.diff.unnamed')}`,
    source: row.source.name,
    fields: {
      instrument: row.instrument,
      micDi: row.mic_di,
      model: row.mic_model,
      stand: row.stand_type,
      notes: row.notes,
    },
  }))
}

function monitorRows(rider: ResolvedRider, t: DiffTranslator): Row[] {
  return rider.monitors.map((mon) => ({
    key: mon.key,
    label: mon.label || t('rider.diff.monitorFallback'),
    source: mon.source.name,
    fields: {
      type: mon.type,
      config: mon.config,
      mix: mon.mix_description,
      iemPack: t(`rider.diff.values.${mon.iem_own_pack ? 'own' : 'provided'}`),
      iemModel: mon.iem_transmitter_model,
      iemFrequency: mon.iem_frequency,
    },
  }))
}

function backlineRows(rider: ResolvedRider, t: DiffTranslator): Row[] {
  return rider.backline.map((item) => ({
    key: item.key,
    label: item.name || t(`rider.rig.backline.categories.${item.category}`),
    source: item.source.name,
    fields: {
      category: item.category,
      brand: item.brand_preference,
      specs: item.specs,
      notes: item.notes,
    },
  }))
}

function wirelessRows(rider: ResolvedRider, t: DiffTranslator): Row[] {
  return rider.wireless.map((unit) => ({
    key: unit.key,
    label: unit.brand_model || unit.type,
    source: unit.source.name,
    fields: {
      type: unit.type,
      model: unit.brand_model,
      band: unit.frequency_band,
      unit: t(`rider.diff.values.${unit.own_unit ? 'own' : 'provided'}`),
      notes: unit.notes,
    },
  }))
}

function powerRows(rider: ResolvedRider): Row[] {
  return rider.power.positions.map((pos) => ({
    key: pos.key,
    label: pos.location,
    source: pos.source.name,
    fields: {
      outlets: String(pos.outlets_needed),
      notes: pos.notes,
    },
  }))
}

// ── Resolving a snapshot ──────────────────────────────────────────────────────

/**
 * A snapshot resolves against the setups frozen inside it, never against the
 * live library — that is the whole point of having frozen it.
 */
export function resolveSnapshot(
  snapshot: PublishedRider,
  labels: ResolverLabels = EN_RESOLVER_LABELS,
  instrumentNames?: InstrumentLabels,
): ResolvedRider {
  const setups: SetupLookup = Object.fromEntries(
    Object.entries(snapshot.rider.referenced_setups ?? {}).map(([id, s]) => [Number(id), s]),
  )

  return resolveRider(snapshot.rider, setups, snapshot.members ?? [], labels, instrumentNames)
}

// ── The diff ──────────────────────────────────────────────────────────────────

/**
 * Section keys, not titles. They used to be the English words themselves —
 * rendered straight into the version-diff modal by RiderVersionHistory, and
 * used to look up a two-form noun table for the summary. Both were English in
 * a Polish panel, and two forms cannot express a Polish plural at all:
 * "5 kanały" instead of "5 kanałów".
 *
 * The catalogue owns the words now, and vue-i18n owns the plural rule.
 */
export type RiderDiffSectionKey = 'channels' | 'monitors' | 'backline' | 'wireless' | 'power'

const COUNT_KEYS = new Set<string>(['channels', 'monitors', 'backline', 'wireless', 'power'])

function plural(t: DiffTranslator, key: string, n: number): string {
  const path = `rider.diff.counts.${COUNT_KEYS.has(key) ? key : 'other'}`
  return t(path, n, { named: { n } })
}

/**
 * The subset of vue-i18n's `t` this util needs.
 *
 * Passed in rather than imported: app/vitest.config.ts runs `environment:
 * 'node'`, and anything reaching useI18n() here would pull in localStorage at
 * module load. Same reason riderGaps.ts takes one. See app/CLAUDE.md.
 */
export interface DiffTranslator {
  (key: string): string
  (key: string, n: number, opts: { named: { n: number } }): string
}

export function diffRiders(
  before: PublishedRider,
  after: PublishedRider,
  t: DiffTranslator,
  labels: ResolverLabels = EN_RESOLVER_LABELS,
  instrumentNames?: InstrumentLabels,
): RiderDiff {
  // Both sides resolve with the same bundle: a locale change must not read as
  // a change to the rider.
  const a = resolveSnapshot(before, labels, instrumentNames)
  const b = resolveSnapshot(after, labels, instrumentNames)

  const sections: RiderDiffSection[] = [
    { title: 'channels', entries: diffRows(channelRows(a, t), channelRows(b, t), t) },
    { title: 'monitors', entries: diffRows(monitorRows(a, t), monitorRows(b, t), t) },
    { title: 'backline', entries: diffRows(backlineRows(a, t), backlineRows(b, t), t) },
    { title: 'wireless', entries: diffRows(wirelessRows(a, t), wirelessRows(b, t), t) },
    { title: 'power', entries: diffRows(powerRows(a), powerRows(b), t) },
  ].filter((section) => section.entries.length > 0)

  return {
    from: before.version.version_number,
    to: after.version.version_number,
    sections,
    summary: summarise(sections, t),
    identical: sections.length === 0,
  }
}

/**
 * The one-line version: "+2 channels · 1 monitor changed · −1 backline item".
 *
 * Counts per section rather than per row, because "what moved" is the question
 * being asked at a glance — the sections below answer "how".
 */
function summarise(sections: RiderDiffSection[], t: DiffTranslator): string {
  const parts: string[] = []

  for (const section of sections) {
    const added = section.entries.filter((e) => e.kind === 'added').length
    const removed = section.entries.filter((e) => e.kind === 'removed').length
    const changed = section.entries.filter((e) => e.kind === 'changed').length

    if (added) parts.push(`+${plural(t, section.title, added)}`)
    if (removed) parts.push(`−${plural(t, section.title, removed)}`)
    if (changed) parts.push(`${plural(t, section.title, changed)} ${t('rider.diff.changed', changed, { named: { n: changed } })}`)
  }

  return parts.join(' · ')
}
