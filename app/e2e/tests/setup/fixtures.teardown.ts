import { test as teardown } from '@playwright/test'
import { purgeSeededFixtures } from '../../fixtures/seed'

/**
 * Removes everything `seedTicket` created, once the whole suite has finished.
 *
 * `e2e:seed-ticket` only ever inserts — a venue, concert, ticket type, price
 * tier, fan account, order and ticket per call — and nothing used to remove
 * them. Left alone that accumulates into the *shared dev database*: 133
 * "Testville" venues had piled up, and because the public site bakes whatever
 * is in the database at container start, every one of them was listed on the
 * public concerts page.
 *
 * This runs as a teardown project rather than an afterAll hook because the
 * fixtures outlive individual specs: seedTicket is called from several files
 * across parallel workers, so the only safe moment to clear them is after all
 * of them are done.
 *
 * It is not the only guard. A suite that is killed never reaches this, so
 * `e2e:seed-ticket` also sweeps fixtures older than six hours when it runs.
 */
teardown('purge seeded e2e fixtures', async () => {
  purgeSeededFixtures()
})
