<?php

use App\Models\AuditLog;
use App\Models\Office;
use App\Models\User;

uses(Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

test('offices index is displayed in chain order', function () {
    Office::factory()->create(['name' => 'Budget', 'sort_order' => 20]);
    Office::factory()->create(['name' => 'ICT', 'sort_order' => 10]);

    $response = $this->get(route('offices.index'));

    $response->assertOk();
    $offices = collect($response->inertiaProps('offices'));
    expect($offices->pluck('name')->all())->toBe(['ICT', 'Budget']);
});

test('office can be created', function () {
    $response = $this->post(route('offices.store'), [
        'name' => 'Accounting',
        'description' => 'Handles payment checks',
    ]);

    $response->assertRedirect(route('offices.index'));

    $office = Office::where('name', 'Accounting')->first();
    expect($office)->not->toBeNull()
        ->and($office->is_active)->toBeTrue()
        ->and($office->sort_order)->toBe(10);

    expect(AuditLog::where('action', 'Office Created')->count())->toBe(1);
});

test('office name must be unique', function () {
    Office::factory()->create(['name' => 'ICT']);

    $this->post(route('offices.store'), ['name' => 'ICT'])
        ->assertSessionHasErrors('name');
});

test('office can be updated', function () {
    $office = Office::factory()->create(['name' => 'Budget']);

    $response = $this->patch(route('offices.update', $office), [
        'name' => 'Budget Management',
        'description' => 'Updated',
    ]);

    $response->assertRedirect(route('offices.index'));
    expect($office->fresh()->name)->toBe('Budget Management');

    expect(AuditLog::where('action', 'Office Updated')->count())->toBe(1);
});

test('office can be deactivated and reactivated', function () {
    $office = Office::factory()->create(['is_active' => true]);

    $this->patch(route('offices.toggle-active', $office));
    expect($office->fresh()->is_active)->toBeFalse();

    $this->patch(route('offices.toggle-active', $office));
    expect($office->fresh()->is_active)->toBeTrue();

    expect(AuditLog::where('action', 'Office Deactivated')->count())->toBe(1)
        ->and(AuditLog::where('action', 'Office Activated')->count())->toBe(1);
});

test('office can be moved down in the chain', function () {
    $first = Office::factory()->create(['sort_order' => 10]);
    $second = Office::factory()->create(['sort_order' => 20]);

    $this->patch(route('offices.move', $first), ['direction' => 'down'])
        ->assertRedirect(route('offices.index'));

    expect($first->fresh()->sort_order)->toBe(20)
        ->and($second->fresh()->sort_order)->toBe(10);
});

test('first office cannot move up and last cannot move down', function () {
    $first = Office::factory()->create(['sort_order' => 10]);
    $second = Office::factory()->create(['sort_order' => 20]);

    $this->patch(route('offices.move', $first), ['direction' => 'up']);
    $this->patch(route('offices.move', $second), ['direction' => 'down']);

    expect($first->fresh()->sort_order)->toBe(10)
        ->and($second->fresh()->sort_order)->toBe(20);
});

test('inactive offices cannot be reordered', function () {
    $active = Office::factory()->create(['sort_order' => 10]);
    $inactive = Office::factory()->create(['sort_order' => 20, 'is_active' => false]);

    $this->patch(route('offices.move', $inactive), ['direction' => 'up']);

    expect($inactive->fresh()->sort_order)->toBe(20)
        ->and($active->fresh()->sort_order)->toBe(10);
});
