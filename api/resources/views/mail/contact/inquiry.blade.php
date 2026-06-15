<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New contact inquiry</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
        .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
        .header { background: #121212; padding: 32px 40px; }
        .header h1 { color: #EFE7D6; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.3px; }
        .header .reason { display: inline-block; margin-top: 8px; background: #E2702A; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 4px 10px; border-radius: 3px; }
        .body { padding: 32px 40px; color: #333; line-height: 1.6; }
        .body p { margin: 0 0 16px; }
        .meta { background: #f9f9f9; border-left: 4px solid #E2702A; padding: 14px 18px; margin-bottom: 24px; }
        .meta p { margin: 0 0 6px; font-size: 14px; }
        .meta p:last-child { margin: 0; }
        .meta strong { color: #121212; }
        .message-box { background: #fafafa; border: 1px solid #e8e8e8; border-radius: 4px; padding: 18px 20px; font-size: 15px; white-space: pre-wrap; word-break: break-word; }
        .reply-btn { display: inline-block; background: #E2702A; color: #fff; text-decoration: none; padding: 13px 26px; font-weight: 600; font-size: 15px; margin: 24px 0 8px; border-radius: 4px; }
        .footer { padding: 20px 40px; border-top: 1px solid #eee; font-size: 12px; color: #aaa; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header">
        <h1>New contact inquiry</h1>
        <span class="reason">{{ ucfirst($data['reason']) }}</span>
    </div>
    <div class="body">
        <div class="meta">
            <p><strong>From:</strong> {{ $data['name'] }} &lt;{{ $data['email'] }}&gt;</p>
            @if(!empty($data['subject']))
                <p><strong>Subject:</strong> {{ $data['subject'] }}</p>
            @endif
        </div>

        <div class="message-box">{{ $data['message'] }}</div>

        <a href="{{ $replyHref }}" class="reply-btn">
            Reply to {{ $data['name'] }}
        </a>
    </div>
    <div class="footer">
        <p>Sent via the contact form on the Skanking Storks website.</p>
    </div>
</div>
</body>
</html>
