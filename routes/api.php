<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BandController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ConcertController;
use App\Http\Controllers\HealthCheckController;
use App\Http\Controllers\PhotoController;
use App\Http\Controllers\PostController;
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
|
| Login:    10 attempts per minute per IP  (brute-force protection)
| Register: 5  attempts per minute per IP  (spam / bot protection)
*/

Route::prefix('auth')->name('api.auth.')->group(function () {

    Route::post('/register', [AuthController::class, 'register'])
        ->middleware('throttle:5,1')
        ->name('register');

    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:10,1')
        ->name('login');

    Route::post('/logout', [AuthController::class, 'logout'])
        ->middleware('auth:api')
        ->name('logout');
});

/*
|--------------------------------------------------------------------------
| Public read-only routes — concerts schedule
|--------------------------------------------------------------------------
*/

Route::get('/venues', [VenueController::class, 'index'])->name('api.venues.index');
Route::get('/venues/{venue}', [VenueController::class, 'show'])->name('api.venues.show');
Route::get('/bands', [BandController::class, 'index'])->name('api.bands.index');
Route::get('/bands/{band}', [BandController::class, 'show'])->name('api.bands.show');
Route::get('/concerts', [ConcertController::class, 'index'])->name('api.concerts.index');
Route::get('/concerts/{concert}', [ConcertController::class, 'show'])->name('api.concerts.show');

Route::get('/categories', [CategoryController::class, 'index'])->name('api.categories.index');
Route::get('/categories/{category}', [CategoryController::class, 'show'])->name('api.categories.show');
Route::get('/tags', [TagController::class, 'index'])->name('api.tags.index');
Route::get('/tags/{tag}', [TagController::class, 'show'])->name('api.tags.show');
Route::get('/posts', [PostController::class, 'index'])->name('api.posts.index');
Route::get('/posts/{post}', [PostController::class, 'show'])->name('api.posts.show');

Route::get('/photos', [PhotoController::class, 'index'])->name('api.photos.index');
Route::get('/photos/{photo}', [PhotoController::class, 'show'])->name('api.photos.show');

/*
|--------------------------------------------------------------------------
| Protected routes — valid Passport Bearer token required
|--------------------------------------------------------------------------
*/

Route::middleware('auth:api')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user())->name('api.user');

    Route::post('/venues', [VenueController::class, 'store'])->name('api.venues.store');
    Route::put('/venues/{venue}', [VenueController::class, 'update'])->name('api.venues.update');
    Route::delete('/venues/{venue}', [VenueController::class, 'destroy'])->name('api.venues.destroy');

    Route::post('/bands', [BandController::class, 'store'])->name('api.bands.store');
    Route::put('/bands/{band}', [BandController::class, 'update'])->name('api.bands.update');
    Route::delete('/bands/{band}', [BandController::class, 'destroy'])->name('api.bands.destroy');

    Route::post('/concerts', [ConcertController::class, 'store'])->name('api.concerts.store');
    Route::put('/concerts/{concert}', [ConcertController::class, 'update'])->name('api.concerts.update');
    Route::delete('/concerts/{concert}', [ConcertController::class, 'destroy'])->name('api.concerts.destroy');

    Route::post('/categories', [CategoryController::class, 'store'])->name('api.categories.store');
    Route::put('/categories/{category}', [CategoryController::class, 'update'])->name('api.categories.update');
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->name('api.categories.destroy');

    Route::post('/tags', [TagController::class, 'store'])->name('api.tags.store');
    Route::put('/tags/{tag}', [TagController::class, 'update'])->name('api.tags.update');
    Route::delete('/tags/{tag}', [TagController::class, 'destroy'])->name('api.tags.destroy');

    Route::post('/posts', [PostController::class, 'store'])->name('api.posts.store');
    Route::put('/posts/{post}', [PostController::class, 'update'])->name('api.posts.update');
    Route::delete('/posts/{post}', [PostController::class, 'destroy'])->name('api.posts.destroy');

    Route::post('/photos', [PhotoController::class, 'store'])->name('api.photos.store');
    Route::put('/photos/{photo}', [PhotoController::class, 'update'])->name('api.photos.update');
    Route::delete('/photos/{photo}', [PhotoController::class, 'destroy'])->name('api.photos.destroy');
});
