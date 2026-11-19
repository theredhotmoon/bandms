<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>New comments</title></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #111;">
    <p>New on <strong>{{ $postTitle }}</strong>:</p>
    @foreach ($comments as $comment)
        <p style="margin: 16px 0 4px;"><strong>{{ $comment['author'] }}</strong></p>
        <blockquote style="margin: 0; padding: 8px 16px; border-left: 3px solid #999; white-space: pre-line;">{{ $comment['body'] }}</blockquote>
    @endforeach
    <p style="margin-top: 20px;">These are already visible on the site. To hide or delete one, or to stop a fan commenting:</p>
    <p><a href="{{ $moderationUrl }}">{{ $moderationUrl }}</a></p>
</body>
</html>
