-- Force type regeneration by updating table comments
COMMENT ON TABLE public.profiles IS 'User profiles with status tracking';
COMMENT ON TABLE public.chats IS 'Chat conversations (private, group, or channel)';
COMMENT ON TABLE public.messages IS 'Chat messages with media support';
COMMENT ON TABLE public.call_history IS 'Call history records';
COMMENT ON TABLE public.message_reads IS 'Message read receipts';