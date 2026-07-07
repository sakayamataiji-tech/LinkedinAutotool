-- AlterTable
ALTER TABLE "CampaignLead" ADD COLUMN     "lockedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CampaignLead_lockedAt_idx" ON "CampaignLead"("lockedAt");
