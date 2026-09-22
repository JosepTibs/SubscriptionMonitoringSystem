<?php

use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function actingAsAdmin(): User
{
    return User::factory()->create();
}

it('creates a flow with ordered steps and audits it', function () {
    $user = actingAsAdmin();
    $offices = Office::factory()->count(3)->create();

    $response = $this->actingAs($user)->post(route('approval-flows.store'), [
        'name' => 'Standard procurement',
        'description' => 'Default chain',
        'steps' => [$offices[2]->id, $offices[0]->id, $offices[1]->id],
    ]);

    $response->assertRedirect(route('approval-flows.index'));

    $flow = ApprovalFlow::where('name', 'Standard procurement')->first();
    expect($flow)->not->toBeNull()
        ->and($flow->steps->pluck('office_id')->all())->toBe([$offices[2]->id, $offices[0]->id, $offices[1]->id])
        ->and($flow->steps->pluck('step_order')->all())->toBe([1, 2, 3]);

    expect(AuditLog::where('action', 'Approval Flow Created')->where('auditable_id', $flow->id)->exists())->toBeTrue();
});

it('rejects duplicate flow names', function () {
    ApprovalFlow::factory()->create(['name' => 'Taken']);
    $user = actingAsAdmin();

    $this->actingAs($user)
        ->post(route('approval-flows.store'), [
            'name' => 'Taken',
            'steps' => [Office::factory()->create()->id],
        ])
        ->assertSessionHasErrors('name');
});

it('rejects duplicate offices within a flow', function () {
    $user = actingAsAdmin();
    $office = Office::factory()->create();

    $this->actingAs($user)
        ->post(route('approval-flows.store'), [
            'name' => 'Dup chain',
            'steps' => [$office->id, $office->id],
        ])
        ->assertSessionHasErrors(['steps.0', 'steps.1']);
});

it('requires at least one step', function () {
    $user = actingAsAdmin();

    $this->actingAs($user)
        ->post(route('approval-flows.store'), [
            'name' => 'Empty',
            'steps' => [],
        ])
        ->assertSessionHasErrors('steps');
});

it('replaces steps on update and audits old and new lists', function () {
    $user = actingAsAdmin();
    $flow = ApprovalFlow::factory()->create();
    $first = Office::factory()->create();
    $second = Office::factory()->create();

    ApprovalFlowStep::create([
        'approval_flow_id' => $flow->id,
        'office_id' => $first->id,
        'step_order' => 1,
    ]);

    $this->actingAs($user)
        ->put(route('approval-flows.update', $flow), [
            'name' => $flow->name,
            'description' => null,
            'steps' => [$second->id],
        ])
        ->assertRedirect(route('approval-flows.index'));

    $flow->refresh()->load('steps');
    expect($flow->steps->count())->toBe(1)
        ->and($flow->steps->first()->office_id)->toBe($second->id);

    $audit = AuditLog::where('action', 'Approval Flow Updated')->where('auditable_id', $flow->id)->first();
    expect($audit)->not->toBeNull()
        ->and($audit->old_values['steps'])->toBe([$first->name])
        ->and($audit->new_values['steps'])->toBe([$second->name]);
});

it('enforces a single default flow via set-default and audits it', function () {
    $user = actingAsAdmin();
    $first = ApprovalFlow::factory()->default()->create();
    $second = ApprovalFlow::factory()->create();

    $this->actingAs($user)
        ->patch(route('approval-flows.set-default', $second))
        ->assertRedirect(route('approval-flows.index'));

    expect($second->refresh()->is_default)->toBeTrue()
        ->and($first->refresh()->is_default)->toBeFalse();

    $audit = AuditLog::where('action', 'Approval Flow Set as Default')->where('auditable_id', $second->id)->first();
    expect($audit)->not->toBeNull()
        ->and($audit->old_values['default_flow'])->toBe($first->name)
        ->and($audit->new_values['default_flow'])->toBe($second->name);
});

it('renders the flows index and edit form', function () {
    $user = actingAsAdmin();
    $flow = ApprovalFlow::factory()->create();

    $this->actingAs($user)->get(route('approval-flows.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('approval-flows/index'));

    $this->actingAs($user)->get(route('approval-flows.create'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('approval-flows/create'));

    $this->actingAs($user)->get(route('approval-flows.edit', $flow))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('approval-flows/edit'));
});
