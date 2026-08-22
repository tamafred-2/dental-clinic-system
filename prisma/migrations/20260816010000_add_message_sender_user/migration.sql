-- Attribute staff-authored messages to the authenticated user who wrote them.
ALTER TABLE "Message" ADD COLUMN "senderUserId" TEXT;

CREATE INDEX "Message_senderUserId_createdAt_idx"
ON "Message"("senderUserId", "createdAt");

ALTER TABLE "Message"
ADD CONSTRAINT "Message_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
