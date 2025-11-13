-- Force type regeneration
COMMENT ON TABLE public.profiles IS 'User profiles and status information';
COMMENT ON TABLE public.chats IS 'Chat conversations';
COMMENT ON TABLE public.messages IS 'Chat messages with attachments';
COMMENT ON TABLE public.chat_members IS 'Chat membership and roles';
COMMENT ON TABLE public.chat_requests IS 'Pending chat requests';
COMMENT ON TABLE public.call_history IS 'Call history records';
COMMENT ON TABLE public.message_reactions IS 'Message reactions';
COMMENT ON TABLE public.message_reads IS 'Message read receipts';
COMMENT ON TABLE public.user_ringtones IS 'Custom ringtones per contact';