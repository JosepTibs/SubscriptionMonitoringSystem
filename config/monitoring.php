<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Notification recipients
    |--------------------------------------------------------------------------
    |
    | Only users holding one of these roles receive system notification mail.
    | These match the roles the app already treats as administrators.
    |
    */

    'admin_roles' => ['admin', 'superadmin'],

    /*
    |--------------------------------------------------------------------------
    | Sender identity
    |--------------------------------------------------------------------------
    |
    | The From address shown on every notification. No Reply-To is set: the
    | notification is informational only, so leaving the header off keeps
    | clients from opening a thread against a monitored inbox.
    |
    | The address is read from the untracked .env and falls back to the global
    | mail address, so a missing key cannot leave the envelope without a
    | sender and take every notification down with it.
    |
    */

    'from' => [
        'address' => env('MAIL_NOTIFY_ADDRESS') ?: env('MAIL_FROM_ADDRESS', 'noreply@localhost'),
        'name' => env('MAIL_NOTIFY_NAME', 'Subscription Monitoring System'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Deadline reminder windows
    |--------------------------------------------------------------------------
    |
    | Days before subscriptions.renewal_date at which admins are told a
    | subscription is approaching its deadline. A subscription is reported in
    | the closest window it has entered, so one subscription never produces
    | several emails for overlapping windows.
    |
    */

    'deadline_windows' => [60, 30, 14],

    /*
    |--------------------------------------------------------------------------
    | Reminder deduplication
    |--------------------------------------------------------------------------
    |
    | Seconds a (subscription, window) pair is remembered as "already mailed".
    | Must be longer than the command's schedule interval (daily) so a second
    | run on the same day cannot re-send the same reminder.
    |
    */

    'dedupe_ttl' => 129600,

    /*
    |--------------------------------------------------------------------------
    | No-reply notice
    |--------------------------------------------------------------------------
    |
    | Printed at the top of every notification so a recipient who tries to
    | reply knows the address is not monitored.
    |
    */

    'no_reply_notice' => 'Do not reply to this email.',

];
