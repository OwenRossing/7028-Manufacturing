-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PartStatus" AS ENUM ('DESIGNED', 'CUT', 'MACHINED', 'ASSEMBLED', 'VERIFIED', 'DONE');

-- CreateEnum
CREATE TYPE "PartOwnerRole" AS ENUM ('PRIMARY', 'COLLABORATOR');

-- CreateEnum
CREATE TYPE "PartEventType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'OWNERS_CHANGED', 'PHOTO_ADDED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowAction" AS ENUM ('CREATE', 'UPDATE', 'NO_CHANGE', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PartStatus" NOT NULL DEFAULT 'DESIGNED',
    "quantityRequired" INTEGER NOT NULL DEFAULT 1,
    "quantityComplete" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "onshapeDocumentId" TEXT,
    "onshapeWorkspaceId" TEXT,
    "onshapeElementId" TEXT,
    "onshapePartId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartThumbnail" (
    "partId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartThumbnail_pkey" PRIMARY KEY ("partId")
);

-- CreateTable
CREATE TABLE "PartOwner" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PartOwnerRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartPhoto" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "eventId" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "PartPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartEvent" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" "PartEventType" NOT NULL,
    "fromStatus" "PartStatus",
    "toStatus" "PartStatus",
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PREVIEW',
    "summaryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "externalKey" TEXT,
    "partNumber" TEXT,
    "name" TEXT,
    "quantityNeeded" INTEGER,
    "action" "ImportRowAction" NOT NULL,
    "errorMessage" TEXT,
    "rawJson" JSONB,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "responseJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_season_idx" ON "Project"("season");

-- CreateIndex
CREATE INDEX "Part_partNumber_idx" ON "Part"("partNumber");

-- CreateIndex
CREATE INDEX "Part_name_idx" ON "Part"("name");

-- CreateIndex
CREATE INDEX "Part_status_idx" ON "Part"("status");

-- CreateIndex
CREATE INDEX "Part_projectId_status_idx" ON "Part"("projectId", "status");

-- CreateIndex
CREATE INDEX "Part_onshapeDocumentId_onshapeWorkspaceId_onshapeElementId__idx" ON "Part"("onshapeDocumentId", "onshapeWorkspaceId", "onshapeElementId", "onshapePartId");

-- CreateIndex
CREATE INDEX "Part_projectId_onshapePartId_idx" ON "Part"("projectId", "onshapePartId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_projectId_partNumber_key" ON "Part"("projectId", "partNumber");

-- CreateIndex
CREATE INDEX "PartThumbnail_storageKey_idx" ON "PartThumbnail"("storageKey");

-- CreateIndex
CREATE INDEX "PartOwner_userId_role_idx" ON "PartOwner"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "PartOwner_partId_userId_role_key" ON "PartOwner"("partId", "userId", "role");

-- CreateIndex
CREATE INDEX "PartPhoto_partId_createdAt_idx" ON "PartPhoto"("partId", "createdAt");

-- CreateIndex
CREATE INDEX "PartEvent_partId_createdAt_idx" ON "PartEvent"("partId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ImportRow_batchId_rowIndex_idx" ON "ImportRow"("batchId", "rowIndex");

-- CreateIndex
CREATE INDEX "MutationToken_scope_createdAt_idx" ON "MutationToken"("scope", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MutationToken_token_scope_key" ON "MutationToken"("token", "scope");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartThumbnail" ADD CONSTRAINT "PartThumbnail_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartOwner" ADD CONSTRAINT "PartOwner_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartOwner" ADD CONSTRAINT "PartOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartPhoto" ADD CONSTRAINT "PartPhoto_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartPhoto" ADD CONSTRAINT "PartPhoto_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PartEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartPhoto" ADD CONSTRAINT "PartPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartEvent" ADD CONSTRAINT "PartEvent_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartEvent" ADD CONSTRAINT "PartEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

