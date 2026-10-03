<?php

namespace App\Traits;

use App\Models\activity_logs;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Trait that automatically logs CRUD activity for Eloquent models.
 *
 * Logs created, updated, and deleted events with user information,
 * IP address, user agent, and model changes.
 *
 * Usage: add `use LogsActivity;` inside any business model
 * (alongside `use HasFactory;`). No other setup needed —
 * Eloquent auto-calls `bootLogsActivity()`.
 */
trait LogsActivity
{
    //
    /**
     * Register model event listeners for activity logging.
     *
     * Boot method automatically called by Eloquent to set up observers
     * for created, updated, and deleted events.
     */
    public static function bootLogsActivity(): void
    {
        foreach (['created', 'updated', 'deleted'] as $event) {
            static::$event(function (Model $model) use ($event): void {
                $model->logActivity($event);
            });
        }
    }

    /**
     * Create an activity log entry for the current model event.
     */
    public function logActivity(string $event): void
    {
        // Never log the log table itself (infinite recursion).
        if ($this instanceof activity_logs) {
            return;
        }

        // Skip seeder / console noise, but still log under tests.
        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            return;
        }

        $request = request();

        activity_logs::create([
            'user_id' => $this->resolveActorId(),
            'subject_type' => $this->getMorphClass(),
            'subject_id' => $this->getKey(),
            'event' => $event,
            'description' => $this->getActivityDescription($event),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'properties' => $this->getActivityProperties($event),
            'created_at' => now(),
        ]);
    }

    /**
     * Resolve the acting user id, guarding against self-deletes and stale
     * sessions: the actor row may already be gone (e.g. a user deleting
     * their own account), in which case the log keeps the history with a
     * null actor instead of violating the user FK.
     */
    protected function resolveActorId(): ?int
    {
        $actorId = auth()->id();

        if ($actorId === null) {
            return null;
        }

        // The subject of a self-delete is the actor: the row is already gone.
        if ($this instanceof User && (int) $this->getKey() === (int) $actorId) {
            return null;
        }

        if (! User::whereKey($actorId)->exists()) {
            return null;
        }

        return (int) $actorId;
    }

    /**
     * Generate human-readable description for the activity log.
     *
     * Option A format for approval models: subscription + step + typed
     * names, e.g. "Updated ApprovalRequestStep: 'Netflix' · Step 2 @ Budget
     * — approved by 'Budget Head'".
     *
     * @return string Description like "Created Subscription: Netflix"
     */
    public function getActivityDescription(string $event): string
    {
        $modelName = class_basename($this);
        $displayName = $this->getDisplayName();
        $suffix = $this->getActivitySuffix();

        return match ($event) {
            'created' => "Created {$modelName}: {$displayName}{$suffix}",
            'updated' => "Updated {$modelName}: {$displayName}{$suffix}",
            'deleted' => "Deleted {$modelName}: {$displayName}{$suffix}",
            default => ucfirst($event)." {$modelName}: {$displayName}{$suffix}",
        };
    }

    /**
     * Extra context appended to the description (Option A: typed names).
     *
     * Override per-model; the default is empty so generic models keep the
     * short "Created Model: name" shape.
     */
    protected function getActivitySuffix(): string
    {
        if (method_exists($this, 'activitySuffix')) {
            return (string) $this->activitySuffix();
        }

        return '';
    }

    /**
     * Get a human-readable name for the model instance.
     *
     * Override per-model when the generic guess is wrong:
     * `protected function activityDisplayName(): string { ... }`
     *
     * @return string Display name for the model
     */
    protected function getDisplayName(): string
    {
        if (method_exists($this, 'activityDisplayName')) {
            return (string) $this->activityDisplayName();
        }

        // For User model, prefer username, then computed full name, then email.
        if ($this instanceof User) {
            return $this->getAttribute('username')
                ?? $this->getAttribute('name')
                ?? $this->getAttribute('email')
                ?? (string) $this->getKey();
        }

        // For other models, try common name attributes.
        foreach (['name', 'title', 'username', 'email'] as $key) {
            $value = $this->getAttribute($key);

            if ($value !== null && $value !== '') {
                return (string) $value;
            }
        }

        // Fallback to ID.
        return (string) $this->getKey();
    }

    /**
     * Get the properties to store with the activity log.
     *
     * For updates, stores both old and new values. For other events,
     * stores the original data. Sensitive attributes (password,
     * remember_token, model's $hidden) are always stripped.
     *
     * @return array<string, mixed> Activity properties
     */
    public function getActivityProperties(string $event): array
    {
        $properties = $event === 'updated'
            ? [
                'old' => $this->filterSensitive($this->getOriginal()),
                'new' => $this->filterSensitive($this->getAttributes()),
            ]
            : ['data' => $this->filterSensitive($this->getAttributes())];

        $context = $this->getActivityContext();

        if ($context !== []) {
            $properties['context'] = $context;
        }

        return $properties;
    }

    /**
     * Structured snapshot merged into properties under the "context" key
     * (office, status, typed names + dates). Override per-model; the
     * default is empty so generic models keep the raw attribute payload.
     *
     * @return array<string, mixed>
     */
    protected function getActivityContext(): array
    {
        if (method_exists($this, 'activityContext')) {
            $context = $this->activityContext();

            return is_array($context) ? $context : [];
        }

        return [];
    }

    /**
     * Strip sensitive attributes from a logged payload.
     *
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    protected function filterSensitive(array $attributes): array
    {
        $sensitive = array_unique(array_merge($this->getHidden(), ['password', 'remember_token']));

        return array_diff_key($attributes, array_flip($sensitive));
    }
}
