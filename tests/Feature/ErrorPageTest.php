<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

it('renders the styled 404 page for unknown web routes', function () {
    $this->get('/this-page-does-not-exist')
        ->assertNotFound()
        ->assertInertia(fn ($page) => $page
            ->component('errors/404')
            ->where('status', 404));
});

it('renders the styled 403 page for forbidden web requests', function () {
    Route::middleware('web')->get('/_test/forbidden', fn () => abort(403));

    $this->get('/_test/forbidden')
        ->assertForbidden()
        ->assertInertia(fn ($page) => $page
            ->component('errors/403')
            ->where('status', 403));
});

it('leaves JSON and API error responses to Laravel', function () {
    $this->getJson('/this-page-does-not-exist')
        ->assertNotFound()
        ->assertJsonStructure(['message']);

    $this->get('/api/this-page-does-not-exist')
        ->assertNotFound()
        ->assertHeader('content-type', 'text/html; charset=UTF-8');
});
