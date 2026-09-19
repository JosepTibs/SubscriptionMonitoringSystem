<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Role_has_permissions extends Model
{
    //
    protected $fillable = [
        'permission_id',
        'role_id',
    ];
}
