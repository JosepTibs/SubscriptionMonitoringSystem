<?php

namespace App\Mail;

use App\Models\ApprovalRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApprovalCompletedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(public ApprovalRequest $approvalRequest)
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
        $request = $this->approvalRequest;
        $subscription = $request->subscription;

        return new Envelope(
            from: new Address(
                config('monitoring.from.address'),
                config('monitoring.from.name'),
            ),
            subject: 'Approval Completed: '.$subscription->name,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'mails.approval-completed',
            with: [
                'request' => $this->approvalRequest,
                'subscription' => $this->approvalRequest->subscription,
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
