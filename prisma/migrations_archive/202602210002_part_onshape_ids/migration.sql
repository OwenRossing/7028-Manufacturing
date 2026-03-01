-- Add Onshape identity columns to Part for re-sync.
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "onshapeDocumentId" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "onshapeWorkspaceId" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "onshapeElementId" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "onshapePartId" TEXT;

-- Indexes for Onshape identifier lookup.
CREATE INDEX IF NOT EXISTS "Part_onshapeDocumentId_onshapeWorkspaceId_onshapeElementId_onshapePartId_idx"
ON "Part"("onshapeDocumentId", "onshapeWorkspaceId", "onshapeElementId", "onshapePartId");

CREATE INDEX IF NOT EXISTS "Part_projectId_onshapePartId_idx"
ON "Part"("projectId", "onshapePartId");
