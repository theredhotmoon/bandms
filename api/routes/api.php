<?php

use App\Http\Controllers\ContactController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ShopItemController;
use App\Http\Controllers\ShopItemVariantController;
use App\Http\Controllers\ShopCategoryController;
use App\Http\Controllers\NewsletterSubscriberController;
use App\Http\Controllers\AlbumController;
use App\Http\Controllers\FacebookSyncController;
use App\Http\Controllers\SetlistController;
use App\Http\Controllers\SetlistFmController;
use App\Http\Controllers\SongController;
use App\Http\Controllers\BandCalendarController;
use App\Http\Controllers\EpkVersionController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AuthorController;
use App\Http\Controllers\TechRiderController;
use App\Http\Controllers\PressReleaseController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BandController;
use App\Http\Controllers\BandMemberController;
use App\Http\Controllers\BandMemberSetupController;
use App\Http\Controllers\BandLogoController;
use App\Http\Controllers\BandProfileController;
use App\Http\Controllers\ConcertController;
use App\Http\Controllers\ConcertTicketController;
use App\Http\Controllers\HealthCheckController;
use App\Http\Controllers\InstrumentController;
use App\Http\Controllers\MusicVideoController;
use App\Http\Controllers\PhotoController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ReleaseController;
use App\Http\Controllers\SocialLinkController;
use App\Http\Controllers\TourController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\VenueController;
use App\Http\Controllers\WebsiteModuleController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
*/

Route::get('/health', HealthCheckController::class)->name('api.health');
Route::get('/site-config', [WebsiteModuleController::class, 'siteConfig'])->name('api.site-config');

/*
|--------------------------------------------------------------------------
| Auth routes (public — rate-limited)
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->name('api.auth.')->group(function () {

    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:10,1')
        ->name('login');

    Route::post('/logout', [AuthController::class, 'logout'])
        ->middleware('auth:api')
        ->name('logout');
});

/*
|--------------------------------------------------------------------------
| Public read-only routes
|--------------------------------------------------------------------------
*/

Route::get('/band-profile', [BandProfileController::class, 'show'])->name('api.band-profile.show');
Route::get('/band-profile/calendar/availability', [BandCalendarController::class, 'availability'])->name('api.calendar.availability');
Route::get('/band-profile/epk', [BandProfileController::class, 'showEpk'])->name('api.band-profile.epk');
Route::get('/band-profile/members', [BandMemberController::class, 'index'])->name('api.band-profile.members.index');
Route::get('/band-profile/social-links', [SocialLinkController::class, 'index'])->name('api.band-profile.social-links.index');

Route::get('/concerts', [ConcertController::class, 'index'])->name('api.concerts.index');
Route::get('/concerts/{concert}', [ConcertController::class, 'show'])->name('api.concerts.show');
Route::get('/concerts/{concert}/setlist', [SetlistController::class, 'showByConcert'])->name('api.concerts.setlist');
Route::get('/concerts/{concert}/tickets', [ConcertTicketController::class, 'index'])->name('api.concerts.tickets.index');

Route::post('/door-check', [ConcertTicketController::class, 'doorCheck'])->middleware(['throttle:60,1', 'auth:api'])->name('api.door-check');
Route::post('/door-check/scan', [ConcertTicketController::class, 'doorScan'])->middleware('auth:api')->name('api.door-check.scan');

Route::get('/tags', [TagController::class, 'index'])->name('api.tags.index');
Route::get('/tags/{tag}', [TagController::class, 'show'])->name('api.tags.show');

Route::get('/posts', [PostController::class, 'index'])->name('api.posts.index');
Route::get('/posts/{post}', [PostController::class, 'show'])->name('api.posts.show');

Route::get('/albums', [AlbumController::class, 'index'])->name('api.albums.index');
Route::get('/albums/{album}', [AlbumController::class, 'show'])->name('api.albums.show');

Route::get('/photos', [PhotoController::class, 'index'])->name('api.photos.index');
Route::get('/photos/{photo}', [PhotoController::class, 'show'])->name('api.photos.show');

Route::get('/releases', [ReleaseController::class, 'index'])->name('api.releases.index');
Route::get('/releases/{release}', [ReleaseController::class, 'show'])->name('api.releases.show');

Route::get('/tech-riders/active', [TechRiderController::class, 'showActive'])->name('api.tech-riders.active');
Route::get('/public/rider/{token}', [TechRiderController::class, 'showByToken'])->name('api.tech-riders.public');

Route::get('/tours', [TourController::class, 'index'])->name('api.tours.index');
Route::get('/tours/{tour}', [TourController::class, 'show'])->name('api.tours.show');

Route::get('/press-releases', [PressReleaseController::class, 'index'])->name('api.press-releases.index');
Route::get('/press-releases/{pressRelease}', [PressReleaseController::class, 'show'])->name('api.press-releases.show');

Route::get('/music-videos', [MusicVideoController::class, 'index'])->name('api.music-videos.index');

Route::get('/instruments', [InstrumentController::class, 'index'])->name('api.instruments.index');

Route::get('/shop', [ShopItemController::class, 'index'])->name('api.shop.index');
Route::get('/shop/by-slug/{slug}', [ShopItemController::class, 'showBySlug'])->name('api.shop.show-by-slug');
Route::get('/shop/{shopItem}', [ShopItemController::class, 'show'])->name('api.shop.show');
Route::get('/shop-categories', [ShopCategoryController::class, 'index'])->name('api.shop-categories.index');

Route::post('/checkout', [CheckoutController::class, 'checkout'])->middleware('throttle:20,1')->name('api.checkout');
Route::post('/webhooks/stripe', [CheckoutController::class, 'webhook'])->name('api.webhooks.stripe');
Route::get('/orders/{uuid}', [OrderController::class, 'show'])->name('api.orders.show');

Route::post('/contact', [ContactController::class, 'store'])
    ->middleware('throttle:5,1')
    ->name('api.contact.store');

Route::post('/newsletter/subscribe', [NewsletterSubscriberController::class, 'subscribe'])
    ->middleware('throttle:5,1')
    ->name('api.newsletter.subscribe');

Route::get('/newsletter/confirm/{token}', [NewsletterSubscriberController::class, 'confirm'])
    ->middleware('throttle:20,1')
    ->name('api.newsletter.confirm');

Route::get('/newsletter/unsubscribe/{token}', [NewsletterSubscriberController::class, 'unsubscribe'])
    ->middleware('throttle:20,1')
    ->name('api.newsletter.unsubscribe');

Route::get('/authors', [AuthorController::class, 'index'])->name('api.authors.index');
Route::get('/authors/{author}', [AuthorController::class, 'show'])->name('api.authors.show');

/*
|--------------------------------------------------------------------------
| Protected routes — valid Passport Bearer token required
|--------------------------------------------------------------------------
*/

Route::middleware('auth:api')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user())->name('api.user');

    // ── Any authenticated user: venues read ────────────────────────────────
    Route::get('/venues', [VenueController::class, 'index'])->name('api.venues.index');
    Route::get('/venues/{venue}', [VenueController::class, 'show'])->name('api.venues.show');

    // ── Member + Admin: own BandMember record & setups ─────────────────────

    // Static segment must come before the {member} wildcard to avoid shadowing.
    Route::put('/band-profile/members/reorder', [BandMemberController::class, 'reorder'])
        ->middleware('role:admin')
        ->name('api.band-profile.members.reorder');

    Route::put('/band-profile/members/{member}', [BandMemberController::class, 'update'])
        ->middleware('role:admin,member')
        ->name('api.band-profile.members.update');

    Route::get('/band-profile/members/{member}/setups', [BandMemberSetupController::class, 'index'])
        ->middleware('role:admin,member')
        ->name('api.member-setups.index');
    Route::post('/band-profile/members/{member}/setups', [BandMemberSetupController::class, 'store'])
        ->middleware('role:admin,member')
        ->name('api.member-setups.store');
    Route::get('/band-profile/members/{member}/setups/{setup}', [BandMemberSetupController::class, 'show'])
        ->middleware('role:admin,member')
        ->name('api.member-setups.show');
    Route::put('/band-profile/members/{member}/setups/{setup}', [BandMemberSetupController::class, 'update'])
        ->middleware('role:admin,member')
        ->name('api.member-setups.update');
    Route::delete('/band-profile/members/{member}/setups/{setup}', [BandMemberSetupController::class, 'destroy'])
        ->middleware('role:admin,member')
        ->name('api.member-setups.destroy');

    // ── Publisher + Admin: posts ────────────────────────────────────────────

    Route::post('/posts', [PostController::class, 'store'])
        ->middleware('role:admin,publisher')
        ->name('api.posts.store');
    Route::put('/posts/{post}', [PostController::class, 'update'])
        ->middleware('role:admin,publisher')
        ->name('api.posts.update');
    Route::delete('/posts/{post}', [PostController::class, 'destroy'])
        ->middleware('role:admin,publisher')
        ->name('api.posts.destroy');

    // ── Admin-only routes ───────────────────────────────────────────────────

    Route::middleware('role:admin')->group(function () {

        // User management (admin creates/manages all user accounts)
        Route::get('/users', [UserController::class, 'index'])->name('api.users.index');
        Route::post('/users', [UserController::class, 'store'])->name('api.users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('api.users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('api.users.destroy');

        Route::get('/band-profile/calendar/events', [BandCalendarController::class, 'events'])->name('api.calendar.events');
        Route::put('/band-profile', [BandProfileController::class, 'update'])->name('api.band-profile.update');
        Route::post('/band-profile/sync-facebook-likes', [FacebookSyncController::class, 'syncLikes'])->name('api.band-profile.sync-facebook-likes');
        Route::post('/band-profile/tech-rider', [BandProfileController::class, 'uploadTechRider'])->name('api.band-profile.tech-rider.upload');
        Route::delete('/band-profile/tech-rider', [BandProfileController::class, 'destroyTechRider'])->name('api.band-profile.tech-rider.destroy');
        Route::post('/band-profile/stage-plot', [BandProfileController::class, 'uploadStagePlot'])->name('api.band-profile.stage-plot.upload');
        Route::delete('/band-profile/stage-plot', [BandProfileController::class, 'destroyStagePlot'])->name('api.band-profile.stage-plot.destroy');
        Route::post('/band-profile/members', [BandMemberController::class, 'store'])->name('api.band-profile.members.store');
        Route::post('/band-profile/members/{member}/photo', [BandMemberController::class, 'uploadPhoto'])->name('api.band-profile.members.photo.upload');
        Route::delete('/band-profile/members/{member}', [BandMemberController::class, 'destroy'])->name('api.band-profile.members.destroy');

        // All setups across all members (for tech rider import panel)
        Route::get('/band-profile/member-setups', [BandMemberSetupController::class, 'allSetups'])->name('api.member-setups.all');

        // ── Band logos ────────────────────────────────────────────────────────
        Route::get('/band-profile/logos', [BandLogoController::class, 'index'])
            ->name('api.band-profile.logos.index');
        Route::post('/band-profile/logos', [BandLogoController::class, 'store'])
            ->name('api.band-profile.logos.store');
        Route::put('/band-profile/logos/{logo}', [BandLogoController::class, 'update'])
            ->name('api.band-profile.logos.update');
        Route::post('/band-profile/logos/{logo}/set-default', [BandLogoController::class, 'setDefault'])
            ->name('api.band-profile.logos.set-default');
        Route::delete('/band-profile/logos/{logo}', [BandLogoController::class, 'destroy'])
            ->name('api.band-profile.logos.destroy');

        Route::post('/band-profile/social-links', [SocialLinkController::class, 'store'])->name('api.band-profile.social-links.store');
        Route::put('/band-profile/social-links', [SocialLinkController::class, 'sync'])->name('api.band-profile.social-links.sync');
        Route::put('/band-profile/social-links/{link}', [SocialLinkController::class, 'update'])->name('api.band-profile.social-links.update');
        Route::delete('/band-profile/social-links/{link}', [SocialLinkController::class, 'destroy'])->name('api.band-profile.social-links.destroy');

        Route::post('/venues', [VenueController::class, 'store'])->name('api.venues.store');
        Route::put('/venues/{venue}', [VenueController::class, 'update'])->name('api.venues.update');
        Route::delete('/venues/{venue}', [VenueController::class, 'destroy'])->name('api.venues.destroy');

        Route::get('/bands', [BandController::class, 'index'])->name('api.bands.index');
        Route::get('/bands/{band}', [BandController::class, 'show'])->name('api.bands.show');
        Route::post('/bands', [BandController::class, 'store'])->name('api.bands.store');
        Route::put('/bands/{band}', [BandController::class, 'update'])->name('api.bands.update');
        Route::delete('/bands/{band}', [BandController::class, 'destroy'])->name('api.bands.destroy');

        Route::post('/concerts', [ConcertController::class, 'store'])->name('api.concerts.store');
        Route::put('/concerts/{concert}', [ConcertController::class, 'update'])->name('api.concerts.update');
        Route::delete('/concerts/{concert}', [ConcertController::class, 'destroy'])->name('api.concerts.destroy');
        Route::post('/concerts/{concert}/poster', [ConcertController::class, 'uploadPoster'])->name('api.concerts.poster.upload');
        Route::delete('/concerts/{concert}/poster', [ConcertController::class, 'destroyPoster'])->name('api.concerts.poster.destroy');

        // Ticket types
        Route::post('/concerts/{concert}/tickets', [ConcertTicketController::class, 'store'])->name('api.concerts.tickets.store');
        Route::put('/concerts/{concert}/tickets/{ticketType}', [ConcertTicketController::class, 'update'])->name('api.concerts.tickets.update');
        Route::delete('/concerts/{concert}/tickets/{ticketType}', [ConcertTicketController::class, 'destroy'])->name('api.concerts.tickets.destroy');

        // Price tiers
        Route::post('/concerts/{concert}/tickets/{ticketType}/tiers', [ConcertTicketController::class, 'storeTier'])->name('api.concerts.tickets.tiers.store');
        Route::put('/concerts/{concert}/tickets/{ticketType}/tiers/{tier}', [ConcertTicketController::class, 'updateTier'])->name('api.concerts.tickets.tiers.update');
        Route::delete('/concerts/{concert}/tickets/{ticketType}/tiers/{tier}', [ConcertTicketController::class, 'destroyTier'])->name('api.concerts.tickets.tiers.destroy');

        // Promo codes
        Route::get('/promo-codes', [ConcertTicketController::class, 'promoCodes'])->name('api.promo-codes.index');
        Route::post('/promo-codes', [ConcertTicketController::class, 'storePromoCode'])->name('api.promo-codes.store');
        Route::delete('/promo-codes/{promoCode}', [ConcertTicketController::class, 'destroyPromoCode'])->name('api.promo-codes.destroy');

        Route::post('/tags', [TagController::class, 'store'])->name('api.tags.store');
        Route::put('/tags/{tag}', [TagController::class, 'update'])->name('api.tags.update');
        Route::delete('/tags/{tag}', [TagController::class, 'destroy'])->name('api.tags.destroy');

        Route::post('/albums/batch', [AlbumController::class, 'batchStore'])->name('api.albums.batch');
        Route::put('/albums/{album}', [AlbumController::class, 'update'])->name('api.albums.update');
        Route::delete('/albums/{album}', [AlbumController::class, 'destroy'])->name('api.albums.destroy');
        Route::post('/albums/{album}/photos', [AlbumController::class, 'addPhotos'])->name('api.albums.photos.add');
        Route::delete('/albums/{album}/photos/{photo}', [AlbumController::class, 'removePhoto'])->name('api.albums.photos.remove');
        Route::put('/albums/{album}/photos/reorder', [AlbumController::class, 'reorderPhotos'])->name('api.albums.photos.reorder');

        Route::match(['POST', 'PUT'], '/photos/{photo}', [PhotoController::class, 'update'])->name('api.photos.update');
        Route::delete('/photos/{photo}', [PhotoController::class, 'destroy'])->name('api.photos.destroy');

        Route::post('/releases', [ReleaseController::class, 'store'])->name('api.releases.store');
        Route::put('/releases/{release}', [ReleaseController::class, 'update'])->name('api.releases.update');
        Route::delete('/releases/{release}', [ReleaseController::class, 'destroy'])->name('api.releases.destroy');
        Route::post('/releases/{release}/cover', [ReleaseController::class, 'uploadCover'])->name('api.releases.cover.upload');
        Route::delete('/releases/{release}/cover', [ReleaseController::class, 'destroyCover'])->name('api.releases.cover.destroy');
        Route::post('/releases/{release}/photos', [ReleaseController::class, 'addPhotos'])->name('api.releases.photos.add');
        Route::delete('/releases/{release}/photos/{photo}', [ReleaseController::class, 'removePhoto'])->name('api.releases.photos.remove');
        Route::put('/releases/{release}/photos/reorder', [ReleaseController::class, 'reorderPhotos'])->name('api.releases.photos.reorder');

        Route::post('/tours', [TourController::class, 'store'])->name('api.tours.store');
        Route::put('/tours/{tour}', [TourController::class, 'update'])->name('api.tours.update');
        Route::delete('/tours/{tour}', [TourController::class, 'destroy'])->name('api.tours.destroy');

        Route::post('/press-releases/fetch-meta', [PressReleaseController::class, 'fetchMeta'])->name('api.press-releases.fetch-meta');
        Route::post('/press-releases', [PressReleaseController::class, 'store'])->name('api.press-releases.store');
        Route::put('/press-releases/{pressRelease}', [PressReleaseController::class, 'update'])->name('api.press-releases.update');
        Route::delete('/press-releases/{pressRelease}', [PressReleaseController::class, 'destroy'])->name('api.press-releases.destroy');

        Route::post('/music-videos', [MusicVideoController::class, 'store'])->name('api.music-videos.store');
        Route::post('/music-videos/sync-views', [\App\Http\Controllers\YouTubeSyncController::class, 'syncViewCounts'])->name('api.music-videos.sync-views');
        Route::post('/music-videos/retrieve-metadata', [MusicVideoController::class, 'retrieveMetadata'])->name('api.music-videos.retrieve-metadata');
        Route::put('/music-videos/{musicVideo}', [MusicVideoController::class, 'update'])->name('api.music-videos.update');
        Route::delete('/music-videos/{musicVideo}', [MusicVideoController::class, 'destroy'])->name('api.music-videos.destroy');
        Route::post('/music-videos/{musicVideo}/fetch-preview', [MusicVideoController::class, 'fetchPreview'])->name('api.music-videos.fetch-preview');

        Route::post('/instruments', [InstrumentController::class, 'store'])->name('api.instruments.store');
        Route::put('/instruments/{instrument}', [InstrumentController::class, 'update'])->name('api.instruments.update');
        Route::delete('/instruments/{instrument}', [InstrumentController::class, 'destroy'])->name('api.instruments.destroy');

        Route::post('/authors', [AuthorController::class, 'store'])->name('api.authors.store');
        Route::put('/authors/{author}', [AuthorController::class, 'update'])->name('api.authors.update');
        Route::delete('/authors/{author}', [AuthorController::class, 'destroy'])->name('api.authors.destroy');

        Route::get('/epk-versions', [EpkVersionController::class, 'index'])->name('api.epk-versions.index');
        Route::post('/epk-versions', [EpkVersionController::class, 'store'])->name('api.epk-versions.store');
        Route::post('/epk-versions/{version}/publish', [EpkVersionController::class, 'publish'])->name('api.epk-versions.publish');
        Route::delete('/epk-versions/{version}', [EpkVersionController::class, 'destroy'])->name('api.epk-versions.destroy');

        // Songs library
        Route::get('/songs', [SongController::class, 'index'])->name('api.songs.index');
        Route::post('/songs', [SongController::class, 'store'])->name('api.songs.store');
        Route::put('/songs/{song}', [SongController::class, 'update'])->name('api.songs.update');
        Route::delete('/songs/{song}', [SongController::class, 'destroy'])->name('api.songs.destroy');

        // Setlists — static segments before {setlist} wildcard
        Route::get('/setlists/setlistfm/search', [SetlistFmController::class, 'searchArtist'])->name('api.setlistfm.search');
        Route::get('/setlists/setlistfm/{mbid}/setlists', [SetlistFmController::class, 'artistSetlists'])->name('api.setlistfm.setlists');

        Route::get('/setlists', [SetlistController::class, 'index'])->name('api.setlists.index');
        Route::post('/setlists', [SetlistController::class, 'store'])->name('api.setlists.store');
        Route::get('/setlists/{setlist}', [SetlistController::class, 'show'])->name('api.setlists.show');
        Route::put('/setlists/{setlist}', [SetlistController::class, 'update'])->name('api.setlists.update');
        Route::delete('/setlists/{setlist}', [SetlistController::class, 'destroy'])->name('api.setlists.destroy');

        Route::post('/setlists/{setlist}/items', [SetlistController::class, 'addItem'])->name('api.setlists.items.add');
        Route::put('/setlists/{setlist}/items/reorder', [SetlistController::class, 'reorderItems'])->name('api.setlists.items.reorder');
        Route::put('/setlists/{setlist}/items/{item}', [SetlistController::class, 'updateItem'])->name('api.setlists.items.update');
        Route::delete('/setlists/{setlist}/items/{item}', [SetlistController::class, 'removeItem'])->name('api.setlists.items.remove');

        Route::post('/setlists/import-setlistfm', [SetlistController::class, 'importFromSetlistFm'])->name('api.setlists.import-setlistfm');

        // Newsletter subscribers
        Route::get('/newsletter-subscribers', [NewsletterSubscriberController::class, 'index'])->name('api.newsletter-subscribers.index');
        Route::delete('/newsletter-subscribers/{subscriber}', [NewsletterSubscriberController::class, 'destroy'])->name('api.newsletter-subscribers.destroy');

        // Shop
        Route::get('/shop-admin', [ShopItemController::class, 'adminIndex'])->name('api.shop.admin-index');
        Route::post('/shop', [ShopItemController::class, 'store'])->name('api.shop.store');
        Route::put('/shop/{shopItem}', [ShopItemController::class, 'update'])->name('api.shop.update');
        Route::delete('/shop/{shopItem}', [ShopItemController::class, 'destroy'])->name('api.shop.destroy');
        Route::post('/shop/{shopItem}/photos', [ShopItemController::class, 'uploadPhoto'])->name('api.shop.photos.upload');
        Route::delete('/shop/{shopItem}/photos/{photo}', [ShopItemController::class, 'deletePhoto'])->name('api.shop.photos.delete');
        Route::put('/shop/{shopItem}/photos/reorder', [ShopItemController::class, 'reorderPhotos'])->name('api.shop.photos.reorder');
        Route::get('/shop-currencies', [ShopItemController::class, 'getCurrencies'])->name('api.shop.currencies.get');
        Route::put('/shop-currencies', [ShopItemController::class, 'updateCurrencies'])->name('api.shop.currencies.update');

        Route::get('/shop/{shopItem}/variants', [ShopItemVariantController::class, 'index'])->name('api.shop.variants.index');
        Route::post('/shop/{shopItem}/variants', [ShopItemVariantController::class, 'store'])->name('api.shop.variants.store');
        Route::put('/shop/{shopItem}/variants/{variant}', [ShopItemVariantController::class, 'update'])->name('api.shop.variants.update');
        Route::delete('/shop/{shopItem}/variants/{variant}', [ShopItemVariantController::class, 'destroy'])->name('api.shop.variants.destroy');

        Route::post('/shop-categories', [ShopCategoryController::class, 'store'])->name('api.shop-categories.store');
        Route::put('/shop-categories/{shopCategory}', [ShopCategoryController::class, 'update'])->name('api.shop-categories.update');
        Route::delete('/shop-categories/{shopCategory}', [ShopCategoryController::class, 'destroy'])->name('api.shop-categories.destroy');

        // Website modules
        Route::get('/admin/modules', [WebsiteModuleController::class, 'index'])->name('api.admin.modules.index');
        Route::put('/admin/modules/{slug}', [WebsiteModuleController::class, 'update'])->name('api.admin.modules.update');
        Route::put('/admin/site/settings', [WebsiteModuleController::class, 'updateSettings'])->name('api.admin.site.settings');
        Route::post('/admin/site/rebuild', [WebsiteModuleController::class, 'rebuild'])->name('api.admin.site.rebuild');

        // Tech Riders
        Route::get('/tech-riders', [TechRiderController::class, 'index'])->name('api.tech-riders.index');
        Route::post('/tech-riders', [TechRiderController::class, 'store'])->name('api.tech-riders.store');
        Route::get('/tech-riders/{techRider}', [TechRiderController::class, 'show'])->name('api.tech-riders.show');
        Route::put('/tech-riders/{techRider}', [TechRiderController::class, 'update'])->name('api.tech-riders.update');
        Route::post('/tech-riders/{techRider}/activate', [TechRiderController::class, 'activate'])->name('api.tech-riders.activate');
        Route::delete('/tech-riders/{techRider}', [TechRiderController::class, 'destroy'])->name('api.tech-riders.destroy');
    });
});
