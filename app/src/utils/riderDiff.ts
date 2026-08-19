/**
 * riderDiff.ts
 *
 * What changed between two published versions of a rider.
 *
 * Diffing happens on the *resolved* rider, not on the stored one. A promoter
 * does not care that a placement gained an override; they care that channel 11
 * became a DI and that monitor 3 turned into an IEM. Resolving both snapshots
 * first — with the same @/utils/riderResolver every other surface uses — means
 * this reads the same document the venue reads.
 *
 * Rows are matched by their resolved `key` (`placementId:rowId`), which is
 * stable across versions because placement ids and row ids outlive edits. That
 * is what lets a row be reported as *changed* rather than as one removal and
 * one unrelated addition.
 *
 * Pure functions only — no Vue, no fetching.
 */

import type { BandMember } from '@/types/bandMember'
import type { SetupLookup } from '@/types/bandMemberSetup'
import type { PublishedRider } from '@/types/techRiderVersion'
import { resolveRider } from './riderResolver'
import type { ResolvedRider } from './riderResolver'

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

function diffRows(before: Row[], after: Row[]): DiffEntry[] {
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
      .map((field) => `${field}: ${old.fields[field] || '—'} → ${row.fields[field] || '—'}`)

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

function channelRows(rider: ResolvedRider): Row[] {
  return rider.inputs.map((row) => ({
    key: row.key,
    label: `${row.channel} · ${row.instrument || 'Unnamed'}`,
    source: row.source.name,
    fields: {
      instrument: row.instrument,
      'mic/DI': row.mic_di,
      model: row.mic_model,
      stand: row.stand_type,
      notes: row.notes,
    },
  }))
}

function monitorRows(rider: ResolvedRider): Row[] {
  return rider.monitors.map((mon) => ({
    key: mon.key,
    label: mon.label || 'Monitor',
    source: mon.source.name,
    fields: {
      type: mon.type,
      config: mon.config,
      mix: mon.mix_description,
      'IEM pack': mon.iem_own_pack ? 'own' : 'provided',
      'IEM model': mon.iem_transmitter_model,
      'IEM frequency': mon.iem_frequency,
    },
  }))
}

function backlineRows(rider: ResolvedRider): Row[] {
  return rider.backline.map((item) => ({
    key: item.key,
    label: item.name || item.category.replace(/_/g, ' '),
    source: item.source.name,
    fields: {
      category: item.category,
      brand: item.brand_preference,
      specs: item.specs,
      notes: item.notes,
    },
  }))
}

function wirelessRows(rider: ResolvedRider): Row[] {
  return rider.wireless.map((unit) => ({
    key: unit.key,
    label: unit.brand_model || unit.type,
    source: unit.source.name,
    fields: {
      type: unit.type,
      model: unit.brand_model,
      band: unit.frequency_band,
      unit: unit.own_unit ? 'own' : 'provided',
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
export function resolveSnapshot(snapshot: PublishedRider): ResolvedRider {
  const setups: SetupLookup = Object.fromEntries(
    Object.entries(snapshot.rider.referenced_setups ?? {}).map(([id, s]) => [Number(id), s]),
  )

  return resolveRider(snapshot.rider, setups, (snapshot.members ?? []) as BandMember[])
}

// ── The diff ──────────────────────────────────────────────────────────────────

const NOUNS: Record<string, [string, string]> = {
  Channels: ['channel', 'channels'],
  Monitors: ['monitor', 'monitors'],
  Backline: ['backline item', 'backline items'],
  'RF / Wireless': ['RF unit', 'RF units'],
  Power: ['power position', 'power positions'],
}

function plural(title: string, n: number): string {
  const [one, many] = NOUNS[title] ?? ['change', 'changes']
  return `${n} ${n === 1 ? one : many}`
}

export function diffRiders(before: PublishedRider, after: PublishedRider): RiderDiff {
  const a = resolveSnapshot(before)
  const b = resolveSnapshot(after)

  const sections: RiderDiffSection[] = [
    { title: 'Channels', entries: diffRows(channelRows(a), channelRows(b)) },
    { title: 'Monitors', entries: diffRows(monitorRows(a), monitorRows(b)) },
    { title: 'Backline', entries: diffRows(backlineRows(a), backlineRows(b)) },
    { title: 'RF / Wireless', entries: diffRows(wirelessRows(a), wirelessRows(b)) },
    { title: 'Power', entries: diffRows(powerRows(a), powerRows(b)) },
  ].filter((section) => section.entries.length > 0)

  return {
    from: before.version.version_number,
    to: after.version.version_number,
    sections,
    summary: summarise(sections),
    identical: sections.length === 0,
  }
}

/**
 * The one-line version: "+2 channels · 1 monitor changed · −1 backline item".
 *
 * Counts per section rather than per row, because "what moved" is the question
 * being asked at a glance — the sections below answer "how".
 */
function summarise(sections: RiderDiffSection[]): string {
  const parts: string[] = []

  for (const section of sections) {
    const added = section.entries.filter((e) => e.kind === 'added').length
    const removed = section.entries.filter((e) => e.kind === 'removed').length
    const changed = section.entries.filter((e) => e.kind === 'changed').length

    if (added) parts.push(`+${plural(section.title, added)}`)
    if (removed) parts.push(`−${plural(section.title, removed)}`)
    if (changed) parts.push(`${plural(section.title, changed)} changed`)
  }

  return parts.join(' · ')
}
