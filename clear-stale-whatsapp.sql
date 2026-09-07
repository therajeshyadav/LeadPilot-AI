-- Clear stale HOT_LEAD WhatsApp messages (older than 1 hour)
-- Run this if mid-call WhatsApp is not being sent due to old records

DELETE FROM whatsapp_messages 
WHERE type = 'HOT_LEAD' 
AND created_at < NOW() - INTERVAL '1 hour';

-- Or to clear ALL HOT_LEAD messages (use with caution):
-- DELETE FROM whatsapp_messages WHERE type = 'HOT_LEAD';

-- To see what would be deleted:
SELECT id, lead_id, conversation_id, type, created_at, sent_at, provider_message_id, idempotency_key
FROM whatsapp_messages 
WHERE type = 'HOT_LEAD' 
ORDER BY created_at DESC;
