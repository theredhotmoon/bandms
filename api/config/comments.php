<?php

return [
    // How long the band's "new comment" mail waits after the first comment on
    // a post, so a burst arrives as one mail instead of one per comment.
    // A plain value, not env(): the backend takes no env_file, so an env knob
    // here would do nothing until it was also added to both compose files.
    'mail_delay_seconds' => 120,

    // What a fan may post until the band sets its own limit on the admin's
    // Comments page (CommentSettings).
    'default_limit' => ['max' => 5, 'minutes' => 10],
];
