<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('approval_request_steps', function (Blueprint $table) {
            // The receiving office's contact person, typed by ICT at hand-off
            // (PRD §0: these people have no accounts — the name is data, never
            // derived from the acting user).
            $table->string('received_by_name')->nullable()->after('acted_at');
            $table->timestamp('received_at')->nullable()->after('received_by_name');

            // acted_by_name stored the acting *account's* name; the signatory
            // is a different, account-less person, so the column is renamed to
            // say what it means. See docs/received-by-approved-by-implementation-plan.md.
            $table->renameColumn('acted_by_name', 'approved_by_name');
        });

        // The one pre-existing value was written under the old semantics (the
        // encoder's name). Null it; the trail falls back to actor?.name for
        // legacy rows while that user still exists.
        DB::table('approval_request_steps')
            ->whereNotNull('approved_by_name')
            ->update(['approved_by_name' => null]);
    }

    /**
     * Reverse the migrations.
     *
     * Note: a rollback cannot restore the nulled legacy name.
     */
    public function down(): void
    {
        Schema::table('approval_request_steps', function (Blueprint $table) {
            $table->renameColumn('approved_by_name', 'acted_by_name');
            $table->dropColumn(['received_by_name', 'received_at']);
        });
    }
};
