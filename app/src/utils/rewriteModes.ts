/**
 * What the Enhance menu offers — mirrors api/app/Assistant/Text/RewriteMode.php
 * exactly (rewriteModes.spec.ts reads that file). Labels and hints live in
 * the catalogues under `common.assistant.enhanceModes.<mode>` / `<mode>Hint`.
 */
export const REWRITE_MODES = ['flow', 'punchier', 'shorter', 'longer', 'press'] as const

export type RewriteMode = (typeof REWRITE_MODES)[number]

export function isRewriteMode(value: unknown): value is RewriteMode {
  return typeof value === 'string' && (REWRITE_MODES as readonly string[]).includes(value)
}
