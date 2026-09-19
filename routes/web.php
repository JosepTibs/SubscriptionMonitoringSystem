<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RenewalsController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login')->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('profile', [ProfileController::class, 'show'])->name('profile.show');

    Route::resource('subscriptions', SubscriptionController::class)->except(['destroy']);

    Route::patch('subscriptions/{subscription}/cancel', [SubscriptionController::class, 'cancel'])
        ->name('subscriptions.cancel');

    Route::get('subscriptions/{subscription}/renewals/create', [RenewalsController::class, 'create'])
        ->name('subscriptions.renewals.create');
    Route::post('subscriptions/{subscription}/renewals', [RenewalsController::class, 'store'])
        ->name('subscriptions.renewals.store');

    Route::resource('users', UserController::class)->except(['destroy']);
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
