<?php

test('registration screen can be rendered', function () {
    $response = $this->get('/register');

    $response->assertStatus(200);
});

it('redirects guests to the login page', function () {
    $response = $this->get('/');

    $response->assertRedirect(route('login', absolute: false));
});

test('new users can register', function () {
    $response = $this->post('/register', [
        'username' => 'testuser',
        'fname' => 'Test',
        'lname' => 'User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});
