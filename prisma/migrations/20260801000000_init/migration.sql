-- CreateEnum
CREATE TYPE "GoalGenre" AS ENUM ('ENGLISH', 'MUSCLE_TRAINING', 'STUDY', 'READING', 'DIET', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('MATCHING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "ChallengePaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('AWAITING_PAYMENT', 'ACTIVE', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'REFUNDED', 'NO_REFUND', 'REFUND_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarSeed" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "defaultPaymentMethodId" TEXT,
    "cardRegistered" BOOLEAN NOT NULL DEFAULT false,
    "paidMember" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "genre" "GoalGenre" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dailyDeadline" TEXT NOT NULL DEFAULT '23:59',
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'MATCHING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "genre" "GoalGenre" NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "goalAId" TEXT NOT NULL,
    "goalBId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATE NOT NULL,
    "endedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT,
    "reportDate" DATE NOT NULL,
    "textContent" TEXT NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "systemFeeYen" INTEGER NOT NULL DEFAULT 500,
    "depositYen" INTEGER NOT NULL DEFAULT 3000,
    "totalChargedYen" INTEGER NOT NULL DEFAULT 3500,
    "dailyForfeitYen" INTEGER NOT NULL DEFAULT 100,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "paymentStatus" "ChallengePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "successDays" INTEGER NOT NULL DEFAULT 0,
    "refundAmountYen" INTEGER NOT NULL DEFAULT 0,
    "forfeitedYen" INTEGER NOT NULL DEFAULT 0,
    "stripeRefundId" TEXT,
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "status" "ChallengeStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Goal_genre_status_idx" ON "Goal"("genre", "status");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_goalAId_key" ON "Match"("goalAId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_goalBId_key" ON "Match"("goalBId");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Report_matchId_reportDate_idx" ON "Report"("matchId", "reportDate");

-- CreateIndex
CREATE INDEX "Report_challengeId_reportDate_idx" ON "Report"("challengeId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "Report_matchId_userId_reportDate_key" ON "Report"("matchId", "userId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_stripePaymentIntentId_key" ON "Challenge"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Challenge_status_settlementStatus_idx" ON "Challenge"("status", "settlementStatus");

-- CreateIndex
CREATE INDEX "Challenge_userId_idx" ON "Challenge"("userId");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_goalAId_fkey" FOREIGN KEY ("goalAId") REFERENCES "Goal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_goalBId_fkey" FOREIGN KEY ("goalBId") REFERENCES "Goal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
