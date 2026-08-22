-- Prevent one external channel thread from being imported more than once.
CREATE UNIQUE INDEX "Conversation_channel_channelReference_key"
ON "Conversation"("channel", "channelReference");

-- Support staff inbox filters without scanning every conversation.
CREATE INDEX "Conversation_assignedStaffId_status_updatedAt_idx"
ON "Conversation"("assignedStaffId", "status", "updatedAt");
