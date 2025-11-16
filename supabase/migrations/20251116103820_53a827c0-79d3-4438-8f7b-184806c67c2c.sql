-- Принудительно удалить канал Валерия
DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE chat_id = '36d0f612-7405-4025-8b95-b0a84c269783');
DELETE FROM message_deliveries WHERE message_id IN (SELECT id FROM messages WHERE chat_id = '36d0f612-7405-4025-8b95-b0a84c269783');
DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE chat_id = '36d0f612-7405-4025-8b95-b0a84c269783');
DELETE FROM messages WHERE chat_id = '36d0f612-7405-4025-8b95-b0a84c269783';
DELETE FROM channel_read_markers WHERE chat_id = '36d0f612-7405-4025-8b95-b0a84c269783';
DELETE FROM chat_members WHERE chat_id = '36d0f612-7405-4025-8b95-b0a84c269783';
DELETE FROM chats WHERE id = '36d0f612-7405-4025-8b95-b0a84c269783';