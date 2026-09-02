import { createRouter, createWebHistory } from 'vue-router'
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
    // The SPA has no public home page — Caddy sends "/" to Astro, so this
    // route is unreachable in production and exists purely for dev, where
    // the admin container is browsed directly on :8081. Without it the root
    // renders an empty shell with only a "Sign in" link, which reads as a
    // site that has lost its content rather than an admin panel with no
    // front door. 'admin' degrades correctly: the guard below bounces a
    // signed-out visitor on to 'login'.
    {
      path: '/',
      redirect: '/admin',
    },

    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
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

    // ── Admin panel (requires authentication) ──────────────────────────
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/admin/AdminDashboard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/band-profile',
      name: 'admin-band-profile',
      component: () => import('@/views/admin/BandProfileAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/band-members',
      name: 'admin-band-members',
      component: () => import('@/views/admin/BandMembersAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/bands',
      name: 'admin-bands',
      component: () => import('@/views/admin/BandsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/venues',
      name: 'admin-venues',
      component: () => import('@/views/admin/VenuesAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/concerts',
      name: 'admin-concerts',
      component: () => import('@/views/admin/ConcertsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/posts',
      name: 'admin-posts',
      component: () => import('@/views/admin/PostsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/tags',
      name: 'admin-tags',
      component: () => import('@/views/admin/TagsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/photos',
      name: 'admin-photos',
      component: () => import('@/views/admin/PhotosAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/releases',
      name: 'admin-releases',
      component: () => import('@/views/admin/ReleasesAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/tours',
      name: 'admin-tours',
      component: () => import('@/views/admin/ToursAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/press-releases',
      name: 'admin-press-releases',
      component: () => import('@/views/admin/PressReleasesAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/shop',
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
      path: '/admin/music-videos',
      name: 'admin-music-videos',
      component: () => import('@/views/admin/MusicVideosAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/instruments',
      name: 'admin-instruments',
      component: () => import('@/views/admin/InstrumentsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/pitch',
      name: 'admin-pitch',
      component: () => import('@/views/admin/PitchGeneratorView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/authors',
      name: 'admin-authors',
      component: () => import('@/views/admin/AuthorsAdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/band-calendar',
      name: 'admin-band-calendar',
      component: () => import('@/views/admin/BandCalendarView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/tech-rider',
      name: 'admin-tech-rider',
      component: () => import('@/views/admin/TechRiderAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: '/admin/newsletter',
      name: 'admin-newsletter',
      component: () => import('@/views/admin/NewsletterAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/views/admin/UsersAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: '/admin/setlists',
      name: 'admin-setlists',
      component: () => import('@/views/admin/SetlistsAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: '/admin/my-profile',
      name: 'admin-my-profile',
      component: () => import('@/views/admin/MyProfileView.vue'),
      meta: { requiresAuth: true, requiredRole: 'member' },
    },
    {
      path: '/admin/my-setups',
      name: 'admin-my-setups',
      component: () => import('@/views/admin/MySetupsView.vue'),
      meta: { requiresAuth: true, requiredRole: 'member' },
    },
    {
      path: '/admin/concerts/:concertId/tickets',
      name: 'admin-concert-tickets',
      component: () => import('@/views/admin/ConcertTicketListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/fan-accounts',
      name: 'admin-fan-accounts',
      component: () => import('@/views/admin/FanAccountsAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: '/admin/door',
      name: 'admin-door',
      component: () => import('@/views/admin/DoorCheckView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/website-modules',
      name: 'admin-website-modules',
      component: () => import('@/views/admin/WebsiteModulesView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
    {
      path: '/admin/faqs',
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
      // degrades correctly — the requiresAuth check below bounces a signed-out
      // visitor on to 'login'.
      return { name: 'admin' }
    }
  }

  if (to.meta.requiresAuth && !localStorage.getItem('auth_token')) {
    return { name: 'login' }
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
  login: 'Sign In — Skanking Storks',
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
