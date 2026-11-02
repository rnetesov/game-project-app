ALTER TABLE "ConversationMember" ADD COLUMN "clearedAt" DATETIME;

ALTER TABLE "Message" ADD COLUMN "deletedAt" DATETIME;
