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
        Schema::create('approval_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // procurement | renewal
            $table->foreignId('renewal_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('approval_flow_id')->nullable()->constrained()->nullOnDelete(); // snapshot source, reference only
            $table->foreignId('current_office_id')->nullable()->constrained('offices')->nullOnDelete();
            $table->string('status')->default('in_progress'); // in_progress | completed | returned | rejected
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('approval_requests');
    }
};
