<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A subscription submitted for approval has no confirmed dates yet - they
     * are recorded once the chain completes - so both columns accept null.
     */
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->date('start_date')->nullable()->change();
            $table->date('renewal_date')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->date('start_date')->nullable(false)->change();
            $table->date('renewal_date')->nullable(false)->change();
        });
    }
};
