<?php

return [
    'required' => 'The :attribute field is required.',
    'string'   => 'The :attribute must be a string.',
    'min'      => [
        'string' => 'The :attribute must be at least :min characters.',
    ],
    'max'      => [
        'string' => 'The :attribute may not be greater than :max characters.',
    ],
    'array'    => 'The :attribute must be an array.',
    'url'      => 'The :attribute must be a valid URL.',
    'email'    => 'The :attribute must be a valid email address.',
    'regex'    => 'The :attribute format is invalid.',

    'attributes' => [
        'password'         => 'password',
        'current_password' => 'current password',
    ],
];
