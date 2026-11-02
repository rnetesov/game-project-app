ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");

ALTER TABLE "Notification" ADD COLUMN "commentId" TEXT REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Notification_commentId_idx" ON "Notification"("commentId");
