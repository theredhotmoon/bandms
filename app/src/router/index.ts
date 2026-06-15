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
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
    },
    {
      path: '/videos',
      name: 'videos',
      component: () => import('@/views/MusicVideosView.vue'),
    },
    {
      path: '/contact',
      name: 'contact',
      component: () => import('@/views/ContactView.vue'),
    },
    {
      path: '/booking',
      redirect: { name: 'contact' },
    },
    {
      path: '/concerts',
      name: 'concerts',
      component: () => import('@/views/ConcertsView.vue'),
    },
    {
      path: '/concerts/:id',
      name: 'concert-detail',
      component: () => import('@/views/ConcertDetailView.vue'),
    },
    {
      path: '/releases',
      name: 'releases',
      component: () => import('@/views/ReleasesView.vue'),
    },
    {
      path: '/posts',
      name: 'posts',
      component: () => import('@/views/PostsView.vue'),
    },
    {
      path: '/posts/new',
      name: 'post-create',
      component: () => import('@/views/PostFormView.vue'),
    },
    {
      path: '/posts/:id',
      name: 'post-detail',
      component: () => import('@/views/PostDetailView.vue'),
    },
    {
      path: '/posts/:id/edit',
      name: 'post-edit',
      component: () => import('@/views/PostFormView.vue'),
    },
    {
      path: '/photos',
      name: 'photos',
      component: () => import('@/views/PhotosView.vue'),
    },
    {
      path: '/photos/:id',
      name: 'photo-detail',
      component: () => import('@/views/PhotoDetailView.vue'),
    },
    {
      path: '/photos/:id/edit',
      redirect: () => ({ name: 'photos' }),
    },

    // ── Merch / shop ──────────────────────────────────────────────────
    {
      path: '/merch',
      name: 'merch',
      component: () => import('@/views/MerchView.vue'),
    },
    {
      path: '/merch/success',
      name: 'merch-success',
      component: () => import('@/views/MerchSuccessView.vue'),
    },
    {
      path: '/merch/cancel',
      name: 'merch-cancel',
      component: () => import('@/views/MerchCancelView.vue'),
    },
    {
      path: '/merch/:slug',
      name: 'merch-item',
      component: () => import('@/views/MerchItemView.vue'),
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('@/views/CartView.vue'),
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('@/views/CheckoutView.vue'),
    },
    {
      path: '/shop',
      redirect: { name: 'merch' },
    },
    {
      path: '/shop/:slug',
      redirect: (to) => ({ name: 'merch-item', params: { slug: to.params.slug } }),
    },
    // Alias routes for redesigned public pages
    { path: '/shows', redirect: { name: 'concerts' } },
    { path: '/gallery', redirect: { name: 'photos' } },
    { path: '/news', redirect: { name: 'posts' } },
    { path: '/music', redirect: { name: 'releases' } },

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
      path: '/press',
      name: 'press',
      component: () => import('@/views/PressReleasesView.vue'),
    },
    {
      path: '/epk',
      name: 'epk',
      component: () => import('@/views/EpkView.vue'),
    },
    {
      path: '/links',
      name: 'links',
      component: () => import('@/views/LinksView.vue'),
    },
    {
      path: '/one-sheet',
      name: 'one-sheet',
      component: () => import('@/views/OnesheetView.vue'),
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
      path: '/rider/:token',
      name: 'rider-public',
      component: () => import('@/views/RiderPublicView.vue'),
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
      path: '/newsletter',
      name: 'newsletter',
      component: () => import('@/views/NewsletterView.vue'),
    },
    {
      path: '/newsletter/confirm/:token',
      name: 'newsletter-confirm',
      component: () => import('@/views/NewsletterActionView.vue'),
      props: { action: 'confirm' },
    },
    {
      path: '/newsletter/unsubscribe/:token',
      name: 'newsletter-unsubscribe',
      component: () => import('@/views/NewsletterActionView.vue'),
      props: { action: 'unsubscribe' },
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
  ],
})

// Block path-traversal sequences in route params
const TRAVERSAL_RE = /(\.\.|\/\/|\\|%2e%2e|%252e)/i

router.beforeEach((to) => {
  for (const [key, value] of Object.entries(to.params)) {
    const raw = Array.isArray(value) ? value.join('/') : value
    if (TRAVERSAL_RE.test(raw)) {
      console.warn(`[router] Blocked suspicious param "${key}": ${raw}`)
      return { name: 'home' }
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

export default router
