/**
 * Shared tech-rider domain code.
 *
 * The admin SPA (`app/`) and the public site (`web/`) both render a rider: the
 * band previews the live one by id, a venue opens a published one by token.
 * Both resolve placements into a numbered channel list with the code here
 * rather than each keeping a copy — if the two ever disagreed on numbering,
 * the band would rehearse against one patch list and the venue would patch
 * from another.
 *
 * Everything exported here is framework-agnostic TypeScript. The two Vue
 * components ship from their own entry points so a consumer that only needs
 * the types never pulls Vue in.
 */
export * from './types/bandMember'
export * from './types/bandMemberSetup'
export * from './types/instrument'
export * from './types/instrumentType'
export * from './types/socialLink'
export * from './types/rig'
export * from './types/stagePlot'
export * from './types/techRider'
export * from './types/techRiderVersion'
export * from './instrumentIcons'
export * from './riderResolver'
export * from './stageInstruments'
