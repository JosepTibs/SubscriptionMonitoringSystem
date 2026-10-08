<?php

use App\Http\Controllers\ActivityLogsController;
use App\Http\Controllers\ApprovalFlowController;
use App\Http\Controllers\ApprovalRequestController;
use App\Http\Controllers\ApprovalRequestStepController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RenewalsController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\UserController;
use App\Mail\SendTestEmail;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login')->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('activity-logs', [ActivityLogsController::class, 'index'])->name('activity-logs.index');
    Route::resource('users', UserController::class)->except(['show', 'edit', 'create']);
    Route::patch('users/{user}/archive', [UserController::class, 'archive'])->name('users.archive');
    Route::patch('users/{user}/unarchive', [UserController::class, 'unarchive'])->name('users.unarchive');
    Route::get('profile', [ProfileController::class, 'show'])->name('profile.show');

    Route::get('profile', [ProfileController::class, 'show'])->name('profile.show');

    Route::resource('subscriptions', SubscriptionController::class);

    Route::patch('subscriptions/{subscription}/cancel', [SubscriptionController::class, 'cancel'])
        ->name('subscriptions.cancel');
    Route::patch('subscriptions/{subscription}/archive', [SubscriptionController::class, 'archive'])
        ->name('subscriptions.archive');
    Route::patch('subscriptions/{subscription}/unarchive', [SubscriptionController::class, 'unarchive'])
        ->name('subscriptions.unarchive');

    Route::post('subscriptions/{subscription}/renewals', [RenewalsController::class, 'store'])
        ->name('subscriptions.renewals.store');

    Route::get('approvals', [ApprovalRequestController::class, 'index'])->name('approvals.index');
    Route::get('approvals/create', [ApprovalRequestController::class, 'create'])->name('approvals.create');

    Route::patch('approval-requests/{approval_request}/receive', [ApprovalRequestController::class, 'receive'])
        ->name('approval-requests.receive');
    Route::patch('approval-requests/{approval_request}/approve', [ApprovalRequestController::class, 'approve'])
        ->name('approval-requests.approve');
    Route::patch('approval-requests/{approval_request}/forward', [ApprovalRequestController::class, 'forward'])
        ->name('approval-requests.forward');
    Route::patch('approval-requests/{approval_request}/return', [ApprovalRequestController::class, 'return'])
        ->name('approval-requests.return');
    Route::patch('approval-requests/{approval_request}/archive', [ApprovalRequestController::class, 'archive'])
        ->name('approval-requests.archive');
    Route::patch('approval-requests/{approval_request}/unarchive', [ApprovalRequestController::class, 'unarchive'])
        ->name('approval-requests.unarchive');
    Route::delete('approval-requests/{approval_request}', [ApprovalRequestController::class, 'destroy'])
        ->name('approval-requests.destroy');

    // Administrative corrections to an already-recorded trail row. The runtime
    // stamps its own dates, so this is the only path that may change them.
    Route::patch('approval-request-steps/{approvalRequestStep}', [ApprovalRequestStepController::class, 'update'])
        ->name('approval-request-steps.update');
    Route::delete('approval-request-steps/{approvalRequestStep}', [ApprovalRequestStepController::class, 'destroy'])
        ->name('approval-request-steps.destroy');

    Route::resource('offices', OfficeController::class)->except(['destroy', 'create', 'edit']);
    Route::patch('offices/{office}/toggle-active', [OfficeController::class, 'toggleActive'])
        ->name('offices.toggle-active');

    Route::resource('approval-flows', ApprovalFlowController::class)
        ->except(['show', 'destroy', 'create', 'edit']);
    Route::patch('approval-flows/{approval_flow}/set-default', [ApprovalFlowController::class, 'setDefault'])
        ->name('approval-flows.set-default');

    Route::get('test-mail', function () {
        $message = 'Test lang 2';
        Mail::to('josephteves472@gmail.com')->send(new SendTestEmail($message));
    });
});
require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
