<?php

use App\Mail\ApprovalCompletedMail;
use App\Mail\RenewalDeadlineDigestMail;
use App\Models\ApprovalRequest;
use App\Models\Roles;
use App\Models\Subscription;
use App\Models\User;
use App\Services\AdminNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

function adminAccount(string $email): User
{
    $user = User::factory()->create(['email' => $email]);

    $user->roles()->attach(
        Roles::firstOrCreate(['name' => 'admin', 'guard_name' => 'web'])
    );

    return $user;
}

function subscriptionRenewingIn(int $days, string $status = 'active'): Subscription
{
    return Subscription::factory()->create([
        'status' => $status,
        'renewal_date' => today()->addDays($days)->toDateString(),
    ]);
}

it('mails administrators once a chain is approved', function () {
    Mail::fake();

    $admin = adminAccount('admin@example.com');

    Mail::assertNothingSent();

    // The notifier is what complete() calls; the chain wiring itself is
    // covered by the approval chain tests.
    AdminNotifier::notifyAdmins(new ApprovalCompletedMail(
        ApprovalRequest::factory()->create(),
    ));

    Mail::assertQueued(
        ApprovalCompletedMail::class,
        fn (ApprovalCompletedMail $mail) => $mail->hasTo($admin->email)
    );
});

it('leaves archived and non-admin accounts off the recipient list', function () {
    $admin = adminAccount('admin@example.com');
    $archived = adminAccount('archived@example.com');
    $archived->archive();

    $plain = User::factory()->create(['email' => 'staff@example.com']);

    expect(AdminNotifier::admins()->pluck('email')->all())
        ->toContain($admin->email)
        ->not->toContain($archived->email, $plain->email);
});

it('groups due subscriptions by the closest window they have entered', function () {
    Mail::fake();

    adminAccount('admin@example.com');

    subscriptionRenewingIn(45);
    subscriptionRenewingIn(5);

    $this->artisan('subscriptions:send-deadline-reminders')->assertSuccessful();

    Mail::assertQueued(RenewalDeadlineDigestMail::class, function (RenewalDeadlineDigestMail $mail) {
        // Most urgent window first: 5 days out lands under 14, not 60.
        expect(collect($mail->groups)->pluck('window')->all())
            ->toBe([14, 60]);

        return true;
    });
});

it('reads the windows from configuration instead of a hardcoded list', function () {
    config()->set('monitoring.deadline_windows', [7]);

    Mail::fake();

    adminAccount('admin@example.com');

    // Due under the configured window, and far outside the default 60/30/14, so
    // it can only be reported if the command actually read the config.
    subscriptionRenewingIn(3);

    $this->artisan('subscriptions:send-deadline-reminders')->assertSuccessful();

    Mail::assertQueued(RenewalDeadlineDigestMail::class, function (RenewalDeadlineDigestMail $mail) {
        return $mail->groups[0]['window'] === 7;
    });
});

it('ignores subscriptions beyond the configured windows', function () {
    config()->set('monitoring.deadline_windows', [7]);

    Mail::fake();

    adminAccount('admin@example.com');

    // Inside the default range but outside the narrowed one.
    subscriptionRenewingIn(20);

    $this->artisan('subscriptions:send-deadline-reminders')->assertSuccessful();

    Mail::assertNothingQueued();
});

it('does not repeat a window it has already reported', function () {
    Mail::fake();

    adminAccount('admin@example.com');

    subscriptionRenewingIn(5);

    $this->artisan('subscriptions:send-deadline-reminders')->assertSuccessful();
    $this->artisan('subscriptions:send-deadline-reminders')->assertSuccessful();

    Mail::assertQueued(RenewalDeadlineDigestMail::class, 1);
});

it('skips cancelled, archived and out-of-range subscriptions', function () {
    Mail::fake();

    adminAccount('admin@example.com');

    subscriptionRenewingIn(-2);
    subscriptionRenewingIn(200);
    subscriptionRenewingIn(5, 'cancelled');

    $archived = subscriptionRenewingIn(5);
    $archived->archive();

    $this->artisan('subscriptions:send-deadline-reminders')->assertSuccessful();

    Mail::assertNothingQueued();
});

it('reports nothing when the reminder cache has no matching keys left', function () {
    Mail::fake();

    adminAccount('admin@example.com');

    $subscription = subscriptionRenewingIn(5);

    // Pre-seeding the cache is what a previous run would have done; the command
    // must then find nothing new to say rather than mailing anyway.
    Cache::put("deadline-reminder:{$subscription->id}:14", true, 3600);

    $this->artisan('subscriptions:send-deadline-reminders')->assertSuccessful();

    Mail::assertNothingQueued();
});
