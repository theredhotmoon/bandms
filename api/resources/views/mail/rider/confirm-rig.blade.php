<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm your stage setup</title>
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
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header">
        <h1>Confirm your stage setup</h1>
    </div>
    <div class="body">
        <p>Hi {{ $member->nickname ?: $member->first_name }},</p>

        <p>
            We're putting the technical rider together for <strong>{{ $gigLabel }}</strong>,
            and it uses your saved rig as it stands right now — channels, monitors,
            backline and power.
        </p>

        <p>
            Have a look and confirm it's right, or change it if anything has moved
            since last time. Whatever it says when we send the rider is what the
            venue's engineer will set up.
        </p>

        <p><a href="{{ $setupsUrl }}" class="btn">Review my setup</a></p>

        <p class="fallback">If the button doesn't work, paste this into your browser:<br>{{ $setupsUrl }}</p>
    </div>
    <div class="footer">
        You're getting this because you play in the band and your account can sign in.
    </div>
</div>
</body>
</html>
