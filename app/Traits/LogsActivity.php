<?php

namespace App\Traits;

use App\Models\activity_logs;
use App\Models\projects;
use App\Models\User;
use App\Models\work_item;

/**
 * Trait that automatically logs CRUD activity for Eloquent models.
 *
 * Logs created, updated, and deleted events with user information,
 * IP address, user agent, and model changes.
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
    public static function bootLogsActivity()
    {
        foreach (['created', 'updated', 'deleted'] as $event) {
            static::$event(function ($model) use ($event) {
                $model->logActivity($event);
            });
        }
    }

    /**
     * Create an activity log entry for the current model event.
     */
    public function logActivity(string $event): void
    {
        $request = request();

        activity_logs::create([
            'user_id' => auth()->id(),
            'subject_type' => self::class,
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
     * Generate human-readable description for the activity log.
     *
     * @return string Description like "Created Work Item: Task Title"
     */
    public function getActivityDescription(string $event): string
    {

        $modelName = class_basename($this);
        $displayName = $this->getDisplayName();

        return match ($event) {
            'created' => "Created {$modelName}: {$displayName}",
            'updated' => "Updated {$modelName}: {$displayName}",
            'deleted' => "Deleted {$modelName}: {$displayName}",
        };
    }

    /**
     * Get a human-readable name for the model instance.
     *
     * Checks for common name attributes (username, email, name, title)
     * based on the model type. Falls back to the model ID.
     *
     * @return string Display name for the model
     */
    private function getDisplayName(): string
    {
        // For User model, show username or email
        if ($this instanceof User) {
            $username = $this->getAttribute('username');
            $email = $this->getAttribute('email');

            if ($username) {
                return $username;
            }

            if ($email) {
                return $email;
            }

            return (string) $this->getKey();
        }

        // For Project model
        if ($this instanceof projects) {
            return $this->name ?? (string) $this->getKey();
        }

        // For Work Item model
        if ($this instanceof work_item) {
            return $this->title ?? (string) $this->getKey();
        }

        // For other models, try common name attributes
        if ($this->getAttribute('name')) {
            return $this->getAttribute('name');
        }

        if ($this->getAttribute('title')) {
            return $this->getAttribute('title');
        }

        if ($this->getAttribute('username')) {
            return $this->getAttribute('username');
        }

        // Fallback to ID
        return (string) $this->getKey();
    }

    /**
     * Get the properties to store with the activity log.
     *
     * For updates, stores both old and new values. For other events,
     * stores the original data.
     *
     * @return array Activity properties
     */
    public function getActivityProperties(string $event): array
    {
        if ($event === 'updated') {
            return ['old' => $this->getOriginal(),
                'new' => $this->getAttributes(),
            ];
        }

        return ['data' => $this->getOriginal()];
    }
}
