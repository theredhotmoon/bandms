<?php

return [
    // A fan session lasts this long after its last use (sliding).
    'session_days' => 180,

    // A link session this young may change the password without the current
    // one: opening the emailed link just proved the fan owns the mailbox.
    'fresh_link_minutes' => 15,
];
