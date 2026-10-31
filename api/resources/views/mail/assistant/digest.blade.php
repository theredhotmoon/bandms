<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>This week's assistant digest</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
        .wrapper { max-width: 620px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
        .header { background: #111; padding: 32px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.3px; }
        .body { padding: 28px 40px; color: #333; line-height: 1.55; }
        .body h2 { font-size: 16px; margin: 28px 0 8px; }
        .body h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #777; margin: 16px 0 6px; }
        .item { margin: 0 0 12px; }
        .item a { color: #111; font-weight: 600; text-decoration: none; }
        .item .why { display: block; font-size: 14px; color: #555; }
        .item .meta { display: block; font-size: 12px; color: #999; }
        .btn { display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 24px 0 8px; }
        .footer { padding: 20px 40px; border-top: 1px solid #eee; font-size: 12px; color: #aaa; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header">
        <h1>This week's assistant digest</h1>
    </div>
    <div class="body">
        <p>
            What the nightly crawl found{{ $digest['since'] ? ' since ' . $digest['since']->format('j F') : '' }}
            that is worth a look.
        </p>

        @php
            $item = function ($f) {
                $url  = preg_match('#^https?://#i', $f->url) ? $f->url : null;
                $why  = $f->triage['summary'] ?? $f->snippet;
                return compact('url', 'why');
            };
            $countries = config('countries');
        @endphp

        @if ($digest['leads'])
            <h2>Leads</h2>
            @foreach ($digest['leads'] as $code => $leads)
                <h3>{{ $countries[$code]['name'] ?? ($code === '—' ? 'No country' : $code) }}</h3>
                @foreach ($leads as $f)
                    @php($i = $item($f))
                    <p class="item">
                        @if ($i['url'])<a href="{{ $i['url'] }}">{{ $f->title }}</a>@else<strong>{{ $f->title }}</strong>@endif
                        @if ($i['why'])<span class="why">{{ $i['why'] }}</span>@endif
                        <span class="meta">{{ $f->lead_type ? ucfirst($f->lead_type) . ' · ' : '' }}score {{ $f->score }}</span>
                    </p>
                @endforeach
            @endforeach
        @endif

        @if ($digest['mentions'])
            <h2>Mentions of the band</h2>
            @foreach ($digest['mentions'] as $f)
                @php($i = $item($f))
                <p class="item">
                    @if ($i['url'])<a href="{{ $i['url'] }}">{{ $f->title }}</a>@else<strong>{{ $f->title }}</strong>@endif
                    @if ($i['why'])<span class="why">{{ $i['why'] }}</span>@endif
                </p>
            @endforeach
        @endif

        @if ($digest['news'])
            <h2>News</h2>
            @foreach ($digest['news'] as $f)
                @php($i = $item($f))
                <p class="item">
                    @if ($i['url'])<a href="{{ $i['url'] }}">{{ $f->title }}</a>@else<strong>{{ $f->title }}</strong>@endif
                    @if ($i['why'])<span class="why">{{ $i['why'] }}</span>@endif
                </p>
            @endforeach
        @endif

        <p><a href="{{ $inboxUrl }}" class="btn">Open the inbox</a></p>
    </div>
    <div class="footer">
        Sent every Monday by the admin assistant. Change who gets it in Crawler settings.
    </div>
</div>
</body>
</html>
