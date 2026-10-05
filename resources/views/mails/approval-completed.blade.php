<div style="font-family: Arial, sans-serif; color: #1f2937;">
    <p style="color: #6b7280; font-size: 12px;">
        {{ $noReplyNotice }}
        This message was sent automatically by the Subscription Monitoring System.
    </p>

    <h2>Approval completed</h2>

    <p>
        The <strong>{{ $request->type }}</strong> approval chain
        @if ($request->renewal)
            for the renewal
        @else
            for
        @endif
        <strong>{{ $subscription->name }}</strong> has been fully approved.
    </p>

    <table cellpadding="8" cellspacing="0" border="0"
 style="border-collapse: collapse; margin: 16px 0;">
        <tr>
            <td style="border: 1px solid #d1d5db;"><strong>Provider</strong></td>
            <td style="border: 1px solid #d1d5db;">{{ $subscription->provider }}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #d1d5db;"><strong>Type</strong></td>
            <td style="border: 1px solid #d1d5db;">{{ ucfirst($request->type) }}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #d1d5db;"><strong>Final office</strong></td>
            <td style="border: 1px solid #d1d5db;">{{ $request->currentOffice?->name ?? '—' }}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #d1d5db;"><strong>Subscription status</strong></td>
            <td style="border: 1px solid #d1d5db;">{{ $subscription->status }}</td>
        </tr>
        @if ($subscription->renewal_date)
            <tr>
                <td style="border: 1px solid #d1d5db;"><strong>Next renewal</strong></td>
                <td style="border: 1px solid #d1d5db;">
                    {{ $subscription->renewal_date->format('M j, Y') }}
                </td>
            </tr>
        @endif
        <tr>
            <td style="border: 1px solid #d1d5db;"><strong>Completed at</strong></td>
            <td style="border: 1px solid #d1d5db;">{{ $request->decided_at?->format('M j, Y g:i A') }}</td>
        </tr>
    </table>

    <p>
        <a href="{{ route('subscriptions.show', $subscription->id) }}"
           style="background: #111827; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 4px;">
            Open subscription
        </a>
    </p>
</div>
