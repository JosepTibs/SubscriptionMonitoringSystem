<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;

/**
 * Resolves the accounts that receive system notification mail and hands a
 * single message to all of them.
 *
 * Administrators are identified by role - the same admin/superadmin convention
 * the rest of the app uses for privileged actions - and archived accounts are
 * excluded so deactivated staff stop receiving mail.
 */
class AdminNotifier
{
    /**
     * Every active administrator that has a deliverable email address.
     *
     * @return Collection<int, User>
     */
    public static function admins(): Collection
    {
        $roles = config('monitoring.admin_roles', ['admin', 'superadmin']);

        return User::query()->NotArchived()->whereNotNull('email')->where('email', '!=', '')->whereHas('roles', fn ($query) => $query->whereIn('name', $roles))->get();
    }

    /**
     * Queue a mailable for every administrator in a single delivery.
     */
    public static function notifyAdmins(Mailable $mailable): int
    {
        $recipients = static::admins()->pluck('email')->unique()->all();

        if ($recipients === []) {
            return 0;
        }

        Mail::to($recipients)->queue($mailable);

        return count($recipients);
    }
}
