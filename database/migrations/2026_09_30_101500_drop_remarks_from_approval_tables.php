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
        // A step's free-text notes were never used: the trail carries the typed
        // names and the dates stamped beside them, and the approver's reason -
        // where one is needed - travels with the renewal review instead.
        Schema::table('approval_request_steps', function (Blueprint $table) {
            $table->dropColumn('remarks');
        });

        Schema::table('approval_requests', function (Blueprint $table) {
            $table->dropColumn('remarks');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('approval_requests', function (Blueprint $table) {
            $table->text('remarks')->nullable();
        });

        Schema::table('approval_request_steps', function (Blueprint $table) {
            $table->text('remarks')->nullable();
        });
    }
};
