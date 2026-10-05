<div style="font-family: Arial, sans-serif; color: #1f2937;">
    <p style="color: #6b7280; font-size: 12px;">
        {{ $noReplyNotice }}
        This message was sent automatically by the Subscription Monitoring System.
    </p>

    <h2>Upcoming subscription deadlines</h2>

    <p>These subscriptions are approaching their renewal date.</p>

    @foreach ($groups as $group)
        <h3 style="margin-bottom: 4px;">
            @if ($group['window'] >= 60)
                More than a month away
            @elseif ($group['window'] >= 30)
                About a month away
            @else
                Under two weeks away
            @endif
            <span style="color: #6b7280; font-weight: normal;">
                ({{ $group['subscriptions']->count() }})
            </span>
        </h3>

        <table cellpadding="8" cellspacing="0" border="0"
               style="border-collapse: collapse; width: 100%; margin-bottom: 24px;">
            <thead>
                <tr style="background: #f3f4f6; text-align: left;">
                    <th style="border: 1px solid #d1d5db;">Subscription</th>
                    <th style="border: 1px solid #d1d5db;">Provider</th>
                    <th style="border: 1px solid #d1d5db;">Renewal date</th>
                    <th style="border: 1px solid #d1d5db;">Days left</th>
                    <th style="border: 1px solid #d1d5db;">Cost</th>
                    <th style="border: 1px solid #d1d5db;">Office</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($group['subscriptions'] as $subscription)
                    <tr>
                        <td style="border: 1px solid #d1d5db;">
                            {{ $subscription->name }}
                        </td>
                        <td style="border: 1px solid #d1d5db;">{{ $subscription->provider }}</td>
                        <td style="border: 1px solid #d1d5db;">
                            {{ $subscription->renewal_date->format('M j, Y') }}
                        </td>
                        <td style="border: 1px solid #d1d5db;">{{ $subscription->days_remaining }}</td>
                        <td style="border: 1px solid #d1d5db;">{{ $subscription->cost }}</td>
                        <td style="border: 1px solid #d1d5db;">{{ $subscription->office?->name ?? '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endforeach
</div>
