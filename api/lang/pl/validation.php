<?php

return [
    'required' => 'Pole :attribute jest wymagane.',
    'string'   => 'Pole :attribute musi być tekstem.',
    'min'      => [
        'string' => 'Pole :attribute musi mieć co najmniej :min znaków.',
    ],
    'max'      => [
        'string' => 'Pole :attribute nie może być dłuższe niż :max znaków.',
    ],
    'array'    => 'Pole :attribute musi być tablicą.',
    'url'      => 'Pole :attribute musi być prawidłowym adresem URL.',
    'email'    => 'Pole :attribute musi być prawidłowym adresem e-mail.',
    'regex'    => 'Pole :attribute ma nieprawidłowy format.',

    'attributes' => [
        'password'         => 'hasło',
        'current_password' => 'obecne hasło',
    ],
];
