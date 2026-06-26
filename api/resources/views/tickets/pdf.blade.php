<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Ticket — {{ $ticket->uuid }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 13px;
            color: #1a1a1a;
            background: #fff;
            padding: 30px;
        }
        .ticket {
            border: 2px solid #1a1a1a;
            border-radius: 8px;
            overflow: hidden;
            max-width: 560px;
            margin: 0 auto;
        }
        .header {
            background: #1a1a1a;
            color: #fff;
            padding: 20px 24px;
            text-align: center;
        }
        .header h1 {
            font-size: 26px;
            letter-spacing: 3px;
            text-transform: uppercase;
        }
        .header p {
            font-size: 11px;
            margin-top: 4px;
            opacity: 0.7;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        .body {
            padding: 24px;
        }
        .section {
            margin-bottom: 18px;
            padding-bottom: 18px;
            border-bottom: 1px solid #e5e5e5;
        }
        .section:last-of-type {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        .label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #888;
            margin-bottom: 4px;
        }
        .value {
            font-size: 15px;
            font-weight: bold;
        }
        .value-sm {
            font-size: 13px;
        }
        .row {
            display: flex;
            gap: 24px;
        }
        .col {
            flex: 1;
        }
        .qr-section {
            text-align: center;
            padding: 20px 0 10px;
        }
        .qr-section img {
            width: 160px;
            height: 160px;
        }
        .qr-fallback {
            font-size: 11px;
            font-family: DejaVu Sans Mono, monospace;
            word-break: break-all;
            background: #f5f5f5;
            padding: 8px;
            border-radius: 4px;
        }
        .uuid {
            font-family: DejaVu Sans Mono, monospace;
            font-size: 10px;
            color: #555;
            text-align: center;
            margin-top: 8px;
        }
        .footer-note {
            background: #f5f5f5;
            text-align: center;
            padding: 12px;
            font-size: 11px;
            color: #555;
            border-top: 1px solid #e5e5e5;
        }
    </style>
</head>
<body>
    <div class="ticket">
        <div class="header">
            <h1>{{ config('app.band_name', 'BandMS') }}</h1>
            <p>Official Event Ticket</p>
        </div>

        <div class="body">
            {{-- Ticket type --}}
            <div class="section">
                <div class="label">Ticket Type</div>
                <div class="value">{{ $ticket->concertTicketType?->name ?? 'General Admission' }}</div>
            </div>

            {{-- Concert details --}}
            <div class="section row">
                <div class="col">
                    <div class="label">Venue</div>
                    <div class="value-sm">{{ $ticket->concertTicketType?->concert?->venue?->name ?? '—' }}</div>
                </div>
                <div class="col">
                    <div class="label">Date</div>
                    <div class="value-sm">
                        @if($ticket->concertTicketType?->concert?->date)
                            {{ $ticket->concertTicketType->concert->date->format('d M Y') }}
                        @else
                            —
                        @endif
                    </div>
                </div>
            </div>

            {{-- Holder details --}}
            <div class="section row">
                <div class="col">
                    <div class="label">Ticket Holder</div>
                    <div class="value-sm">{{ $ticket->holder_name ?? '—' }}</div>
                </div>
                <div class="col">
                    <div class="label">Email</div>
                    <div class="value-sm">{{ $ticket->holder_email ?? '—' }}</div>
                </div>
            </div>

            {{-- QR code --}}
            <div class="qr-section">
                @if($qrBase64)
                    <img src="data:image/png;base64,{{ $qrBase64 }}" alt="QR Code for ticket {{ $ticket->uuid }}"/>
                @else
                    {{-- QR generation failed; fall back to text --}}
                    <div class="qr-fallback">{{ $ticket->uuid }}</div>
                @endif
                <div class="uuid">{{ $ticket->uuid }}</div>
            </div>
        </div>

        <div class="footer-note">
            Present this ticket at the door. Valid for one entry only.
        </div>
    </div>
</body>
</html>
