<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('approval_request_steps', function (Blueprint $table) {
            // Snapshot of the acting user's name at the moment of the action:
            // acted_by is nullOnDelete, so the FK alone cannot name the actor
            // once that user is removed.
            $table->string('acted_by_name')->nullable()->after('acted_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('approval_request_steps', function (Blueprint $table) {
            $table->dropColumn('acted_by_name');
        });
    }
};
