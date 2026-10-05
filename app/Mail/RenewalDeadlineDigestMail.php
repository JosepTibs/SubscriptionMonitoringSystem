<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RenewalDeadlineDigestMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(public array $groups)
    {
        //
    }

    /**
     * Get the message envelope.
     *
     * No Reply-To is set: the notification carries nothing a recipient can act
     * on, and omitting the header leaves clients falling back to the From
     * address rather than opening a second monitored inbox.
     */
    public function envelope(): Envelope
    {
        $count = collect($this->groups)->sum(fn (array $group) => $group['subscriptions']->count());

        return new Envelope(
            from: new Address(
                config('monitoring.from.address'),
                config('monitoring.from.name'),
            ),
            subject: $count === 1
                ? '1 subscription is approaching its renewal deadline'
                : "{$count} subscriptions are approaching their deadline",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'mails.renewal-deadline-digest',
            with: [
                'groups' => $this->groups,
                'noReplyNotice' => config('monitoring.no_reply_notice'),
            ],
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
