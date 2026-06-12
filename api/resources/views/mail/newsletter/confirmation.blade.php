<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm your subscription</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
        .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
        .header { background: #111; padding: 32px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.3px; }
        .body { padding: 32px 40px; color: #333; line-height: 1.6; }
        .body p { margin: 0 0 16px; }
        .btn { display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
        .fallback { font-size: 13px; color: #888; word-break: break-all; }
        .footer { padding: 20px 40px; border-top: 1px solid #eee; font-size: 12px; color: #aaa; }
        .footer a { color: #888; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header">
        <h1>Confirm your subscription</h1>
    </div>
    <div class="body">
        @if($subscriber->name)
            <p>Hi {{ $subscriber->name }},</p>
        @else
            <p>Hi there,</p>
        @endif
        <p>Thanks for signing up to the newsletter! Click the button below to confirm your email address and activate your subscription.</p>

        <a href="{{ $confirmUrl }}" class="btn">Confirm my subscription</a>

        <p class="fallback">Or paste this link into your browser:<br>{{ $confirmUrl }}</p>

        <p>If you didn't sign up, you can safely ignore this email — your address won't be added.</p>
    </div>
    <div class="footer">
        <p>You received this because someone entered your email at {{ parse_url($confirmUrl, PHP_URL_HOST) }}.</p>
        <p><a href="{{ $unsubscribeUrl }}">Unsubscribe</a> · This link expires once confirmed.</p>
    </div>
</div>
</body>
</html>
