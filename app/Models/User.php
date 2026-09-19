<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The accessors to append to the model's array form.
     *
     * @var list<string>
     */
    protected $appends = ['name'];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'username',
        'fname',
        'mname',
        'lname',
        'sname',
        'email',
        'email_verified_at',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function roles(): MorphToMany
    {
        return $this->morphToMany(Roles::class, 'model', 'model_has_roles', 'model_id', 'role_id');
    }

    /**
     * Computed full name for the frontend (users table has no name column).
     */
    protected function getNameAttribute(): string
    {
        return collect([$this->fname, $this->mname, $this->lname, $this->sname])
            ->filter()
            ->implode(' ');
    }

    public function hasRole(string $role): bool
    {
        return $this->roles->contains(fn ($r) => strtolower($r->name) === strtolower($role));
    }

    /**
     * Determine whether this user has the given permission through their roles.
     */
    public function hasPermission(string $permission): bool
    {
        $this->loadMissing('roles.permissions');

        return $this->roles->contains(fn ($role) => $role->permissions->contains('name', $permission));
    }
}
