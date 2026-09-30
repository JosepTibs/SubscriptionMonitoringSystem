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
            // Releasing the papers onward ("sent") is a different event from
            // signing them off ("approved", kept in acted_at), so the audit
            // trail needs its own person and timestamp for it. Both nullable:
            // steps forwarded before this migration, and steps that have not
            // moved yet, have neither.
            $table->string('forwarded_by_name')->nullable()->after('approved_by_name');
            $table->timestamp('forwarded_at')->nullable()->after('forwarded_by_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('approval_request_steps', function (Blueprint $table) {
            $table->dropColumn(['forwarded_by_name', 'forwarded_at']);
        });
    }
};
