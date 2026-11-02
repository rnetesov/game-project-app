CREATE TABLE "PostReaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PostReaction_postId_userId_key" ON "PostReaction"("postId", "userId");
CREATE INDEX "PostReaction_postId_type_idx" ON "PostReaction"("postId", "type");
CREATE INDEX "PostReaction_userId_idx" ON "PostReaction"("userId");
INSERT INTO "PostReaction" ("id", "postId", "userId", "type", "createdAt")
SELECT 'legacy_' || "id", "postId", "userId", 'HEART', "createdAt" FROM "PostLike";
