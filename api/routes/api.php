<?php

use App\Http\Controllers\AlbumController;
use App\Http\Controllers\EpkVersionController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AuthorController;
use App\Http\Controllers\TechRiderController;
use App\Http\Controllers\PressReleaseController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BandController;
use App\Http\Controllers\BandMemberController;
use App\Http\Controllers\BandMemberSetupController;
use App\Http\Controllers\BandProfileController;
use App\Http\Controllers\ConcertController;
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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
*/

Route::get('/health', HealthCheckController::class)->name('api.health');

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
Route::get('/band-profile/epk', [BandProfileController::class, 'showEpk'])->name('api.band-profile.epk');
Route::get('/band-profile/members', [BandMemberController::class, 'index'])->name('api.band-profile.members.index');
Route::get('/band-profile/social-links', [SocialLinkController::class, 'index'])->name('api.band-profile.social-links.index');

Route::get('/venues', [VenueController::class, 'index'])->name('api.venues.index');
Route::get('/venues/{venue}', [VenueController::class, 'show'])->name('api.venues.show');

Route::get('/concerts', [ConcertController::class, 'index'])->name('api.concerts.index');
Route::get('/concerts/{concert}', [ConcertController::class, 'show'])->name('api.concerts.show');

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

Route::get('/tours', [TourController::class, 'index'])->name('api.tours.index');
Route::get('/tours/{tour}', [TourController::class, 'show'])->name('api.tours.show');

Route::get('/press-releases', [PressReleaseController::class, 'index'])->name('api.press-releases.index');
Route::get('/press-releases/{pressRelease}', [PressReleaseController::class, 'show'])->name('api.press-releases.show');

Route::get('/music-videos', [MusicVideoController::class, 'index'])->name('api.music-videos.index');

Route::get('/instruments', [InstrumentController::class, 'index'])->name('api.instruments.index');

Route::get('/authors', [AuthorController::class, 'index'])->name('api.authors.index');
Route::get('/authors/{author}', [AuthorController::class, 'show'])->name('api.authors.show');

/*
|--------------------------------------------------------------------------
| Protected routes — valid Passport Bearer token required
|--------------------------------------------------------------------------
*/

Route::middleware('auth:api')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user())->name('api.user');

    // ── Member + Admin: own BandMember record & setups ─────────────────────

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

        Route::put('/band-profile', [BandProfileController::class, 'update'])->name('api.band-profile.update');
        Route::post('/band-profile/tech-rider', [BandProfileController::class, 'uploadTechRider'])->name('api.band-profile.tech-rider.upload');
        Route::delete('/band-profile/tech-rider', [BandProfileController::class, 'destroyTechRider'])->name('api.band-profile.tech-rider.destroy');
        Route::post('/band-profile/stage-plot', [BandProfileController::class, 'uploadStagePlot'])->name('api.band-profile.stage-plot.upload');
        Route::delete('/band-profile/stage-plot', [BandProfileController::class, 'destroyStagePlot'])->name('api.band-profile.stage-plot.destroy');
        Route::post('/band-profile/members', [BandMemberController::class, 'store'])->name('api.band-profile.members.store');
        Route::put('/band-profile/members/reorder', [BandMemberController::class, 'reorder'])->name('api.band-profile.members.reorder');
        Route::post('/band-profile/members/{member}/photo', [BandMemberController::class, 'uploadPhoto'])->name('api.band-profile.members.photo.upload');
        Route::delete('/band-profile/members/{member}', [BandMemberController::class, 'destroy'])->name('api.band-profile.members.destroy');

        // All setups across all members (for tech rider import panel)
        Route::get('/band-profile/member-setups', [BandMemberSetupController::class, 'allSetups'])->name('api.member-setups.all');

        Route::post('/band-profile/social-links', [SocialLinkController::class, 'store'])->name('api.band-profile.social-links.store');
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

        // Tech Riders
        Route::get('/tech-riders', [TechRiderController::class, 'index'])->name('api.tech-riders.index');
        Route::post('/tech-riders', [TechRiderController::class, 'store'])->name('api.tech-riders.store');
        Route::get('/tech-riders/{techRider}', [TechRiderController::class, 'show'])->name('api.tech-riders.show');
        Route::put('/tech-riders/{techRider}', [TechRiderController::class, 'update'])->name('api.tech-riders.update');
        Route::post('/tech-riders/{techRider}/activate', [TechRiderController::class, 'activate'])->name('api.tech-riders.activate');
        Route::delete('/tech-riders/{techRider}', [TechRiderController::class, 'destroy'])->name('api.tech-riders.destroy');
    });
});
