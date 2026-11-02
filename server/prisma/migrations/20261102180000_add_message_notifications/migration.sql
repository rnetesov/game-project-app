ALTER TABLE "Notification"
ADD COLUMN "conversationId" TEXT
REFERENCES "Conversation" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Notification_conversationId_idx"
ON "Notification"("conversationId");
