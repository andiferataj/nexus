-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAccess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_organizationId_clientId_idx" ON "Contact"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "TaskComment_organizationId_taskId_idx" ON "TaskComment"("organizationId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFile_storageKey_key" ON "ProjectFile"("storageKey");

-- CreateIndex
CREATE INDEX "ProjectFile_organizationId_projectId_idx" ON "ProjectFile"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccess_tokenHash_key" ON "PortalAccess"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccess_clientId_organizationId_key" ON "PortalAccess"("clientId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_id_organizationId_key" ON "Task"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_organizationId_fkey" FOREIGN KEY ("taskId", "organizationId") REFERENCES "Task"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_organizationId_fkey" FOREIGN KEY ("projectId", "organizationId") REFERENCES "Project"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

