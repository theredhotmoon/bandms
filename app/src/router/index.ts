import { createRouter, createWebHistory } from 'vue-router'
import { adminUrl } from '@/config/admin'
import type { UserRole } from '@/types/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiredRole?: UserRole | UserRole[]
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // The SPA has no public home page — Caddy sends "/" to Astro, so this route
    // is unreachable through the real site. It exists for dev, where the admin
    // container can be browsed directly on :8082, and resolves through
    // adminUrl() so it follows the panel wherever it is configured to live.
    {
      path: '/',
      redirect: adminUrl(),
    },

    // ── Fan account portal ────────────────────────────────────────────
    {
      path: '/account',
      name: 'fan-account',
      component: () => import('@/views/FanAccountView.vue'),
    },
    {
      path: '/tickets/claim/:token',
      name: 'ticket-claim',
      component: () => import('@/views/TicketClaimView.vue'),
    },

    // ── Admin panel ────────────────────────────────────────────────────
    //
    // The panel root carries NO requiresAuth, and that is the whole point: it
    // renders the sign-in form when signed out and the dashboard when signed
    // in, so there is no separate /login URL for a scanner to find. Everything
    // below it is guarded normally and bounces here, which shows the form.
    {
      path: adminUrl(),
      name: 'admin',
      component: () => import('@/views/admin/AdminEntry.vue'),
    },
    {
      path: adminUrl('band-profile'),
      name: 'admin-band-profile',
      component: () => import('@/views/admin/BandProfileAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('band-members'),
      name: 'admin-band-members',
      component: () => import('@/views/admin/BandMembersAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('bands'),
      name: 'admin-bands',
      component: () => import('@/views/admin/BandsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('venues'),
      name: 'admin-venues',
      component: () => import('@/views/admin/VenuesAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('concerts'),
      name: 'admin-concerts',
      component: () => import('@/views/admin/ConcertsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('posts'),
      name: 'admin-posts',
      component: () => import('@/views/admin/PostsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('tags'),
      name: 'admin-tags',
      component: () => import('@/views/admin/TagsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('photos'),
      name: 'admin-photos',
      component: () => import('@/views/admin/PhotosAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('releases'),
      name: 'admin-releases',
      component: () => import('@/views/admin/ReleasesAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('tours'),
      name: 'admin-tours',
      component: () => import('@/views/admin/ToursAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('press-releases'),
      name: 'admin-press-releases',
      component: () => import('@/views/admin/PressReleasesAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('shop'),
      name: 'admin-shop',
      component: () => import('@/views/admin/ShopAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tech-rider',
      name: 'tech-rider-preview',
      component: () => import('@/views/TechRiderPreviewView.vue'),
    },
    {
      path: '/tech-rider/:id',
      name: 'tech-rider-preview-id',
      component: () => import('@/views/TechRiderPreviewView.vue'),
    },
    {
      path: adminUrl('music-videos'),
      name: 'admin-music-videos',
      component: () => import('@/views/admin/MusicVideosAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('instruments'),
      name: 'admin-instruments',
      component: () => import('@/views/admin/InstrumentsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('pitch'),
      name: 'admin-pitch',
      component: () => import('@/views/admin/PitchGeneratorView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('authors'),
      name: 'admin-authors',
      component: () => import('@/views/admin/AuthorsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('band-calendar'),
      name: 'admin-band-calendar',
      component: () => import('@/views/admin/BandCalendarView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('tech-rider'),
      name: 'admin-tech-rider',
      component: () => import('@/views/admin/TechRiderAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: adminUrl('newsletter'),
      name: 'admin-newsletter',
      component: () => import('@/views/admin/NewsletterAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: adminUrl('users'),
      name: 'admin-users',
      component: () => import('@/views/admin/UsersAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: adminUrl('setlists'),
      name: 'admin-setlists',
      component: () => import('@/views/admin/SetlistsAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: adminUrl('my-profile'),
      name: 'admin-my-profile',
      component: () => import('@/views/admin/MyProfileView.vue'),
      meta: { requiresAuth: true, requiredRole: 'member' },
    },
    {
      path: adminUrl('my-setups'),
      name: 'admin-my-setups',
      component: () => import('@/views/admin/MySetupsView.vue'),
      meta: { requiresAuth: true, requiredRole: 'member' },
    },
    {
      path: adminUrl('concerts/:concertId/tickets'),
      name: 'admin-concert-tickets',
      component: () => import('@/views/admin/ConcertTicketListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('fan-accounts'),
      name: 'admin-fan-accounts',
      component: () => import('@/views/admin/FanAccountsAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: adminUrl('door'),
      name: 'admin-door',
      component: () => import('@/views/admin/DoorCheckView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: adminUrl('website-modules'),
      name: 'admin-website-modules',
      component: () => import('@/views/admin/WebsiteModulesView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: adminUrl('faqs'),
      name: 'admin-faqs',
      component: () => import('@/views/admin/FaqsAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
  ],
})

// Block path-traversal sequences in route params
const TRAVERSAL_RE = /(\.\.|\/\/|\\|%2e%2e|%252e)/i

router.beforeEach((to) => {
  for (const [key, value] of Object.entries(to.params)) {
    const raw = Array.isArray(value) ? value.join('/') : value
    if (TRAVERSAL_RE.test(raw)) {
      console.warn(`[router] Blocked suspicious param "${key}": ${raw}`)
      // 'admin', not 'home': the SPA no longer serves a public home page, and a
      // name vue-router cannot resolve throws instead of blocking. 'admin' also
      // degrades correctly — it renders the sign-in form when signed out.
      return { name: 'admin' }
    }
  }

  // 'admin' is the panel root, which renders the sign-in form for a signed-out
  // visitor. There is no dedicated login route to send them to any more.
  if (to.meta.requiresAuth && !localStorage.getItem('auth_token')) {
    return { name: 'admin' }
  }

  if (to.meta.requiredRole) {
    const stored = localStorage.getItem('auth_user')
    const userRole: string | undefined = stored ? (JSON.parse(stored) as { role?: string }).role : undefined
    const required = Array.isArray(to.meta.requiredRole)
      ? to.meta.requiredRole
      : [to.meta.requiredRole]
    if (userRole && !required.includes(userRole as UserRole)) {
      return { name: 'admin' }
    }
  }
})

// Per-page <title> updates (WCAG 2.4.2)
const ROUTE_TITLES: Record<string, string> = {
  'fan-account': 'My Account — Skanking Storks',
  'ticket-claim': 'Claim Ticket — Skanking Storks',
  'tech-rider-preview': 'Tech Rider — Skanking Storks',
  'tech-rider-preview-id': 'Tech Rider — Skanking Storks',
  'admin-concert-tickets': 'Concert Tickets — Admin',
  'admin-fan-accounts': 'Fan Accounts — Admin',
  'admin-door': 'Door Check — Admin',
  'admin-website-modules': 'Website Modules — Admin',
  'admin-faqs': 'FAQ — Admin',
}

router.afterEach((to) => {
  const name = typeof to.name === 'string' ? to.name : ''
  document.title = ROUTE_TITLES[name] ?? 'Skanking Storks'
})

export default router
