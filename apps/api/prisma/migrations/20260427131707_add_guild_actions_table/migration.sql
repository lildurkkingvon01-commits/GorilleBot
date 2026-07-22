-- CreateTable
CREATE TABLE "guild_actions" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMP(6),

    CONSTRAINT "guild_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_guild_actions_status" ON "guild_actions"("status");

-- CreateIndex
CREATE INDEX "idx_guild_actions_guild_id" ON "guild_actions"("guild_id");
