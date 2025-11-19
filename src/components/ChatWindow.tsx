import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Phone, Video, MoreVertical, Mic, VideoIcon, Search, Settings2, Reply, Users, ArrowLeft, Crown } from "lucide-react";
import ChatActions from "./ChatActions";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { isUserOnline, getLastSeenText } from "@/utils/userStatus";
import FileUpload from "./FileUpload";
import MessageActions from "./MessageActions";
import MessageAttachment from "./MessageAttachment";
import VoiceRecorder from "./VoiceRecorder";
import VideoRecorder from "./VideoRecorder";
import ForwardMessageDialog from "./ForwardMessageDialog";
import MessageStatus from "./MessageStatus";
import MessageReactions from "./MessageReactions";
import MessageSearch from "./MessageSearch";
import GroupManagementDialog from "./GroupManagementDialog";
import AddGroupMemberDialog from "./AddGroupMemberDialog";
import ChannelSettings from "./ChannelSettings";
import ChannelOwnerSettings from "./ChannelOwnerSettings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const messageSchema = z.string()
  .trim()
  .min(1, "Сообщение не может быть пустым")
  .max(2000, "Сообщение слишком длинное (максимум 2000 символов)")
  .refine(
    (msg) => !/[\x00-\x08\x0B-\x0C\x0E-\x1F]/.test(msg),
    "Сообщение содержит недопустимые символы"
  )
  .refine(
    (msg) => !/<script|<iframe|javascript:|onerror=|onload=/i.test(msg),
    "Сообщение содержит потенциально опасный контент"
  )
  .refine(
    (msg) => {
      // Prevent HTML entity injection
      const htmlEntityPattern = /&#x?[0-9a-f]+;|&[a-z]+;/i;
      const entities = msg.match(new RegExp(htmlEntityPattern, 'gi'));
      if (entities) {
        // Allow common safe entities only
        const safeEntities = ['&amp;', '&lt;', '&gt;', '&quot;', '&#39;'];
        return entities.every(entity => safeEntities.includes(entity.toLowerCase()));
      }
      return true;
    },
    "Сообщение содержит подозрительные HTML-сущности"
  );

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  edited_at?: string | null;
  is_deleted?: boolean;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  forwarded_from_message_id?: string | null;
  forwarded_from_chat_id?: string | null;
  replied_to_message_id?: string | null;
  sender?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  read_by?: Array<{ user_id: string }>;
  delivered_to?: Array<{ user_id: string }>;
  replied_message?: {
    content: string;
    sender: { username: string };
  };
}

interface ChatWindowProps {
  chatId: string;
  onBack?: () => void;
  onStartCall?: (params: { chatId: string; otherUserId: string; otherUserName: string; callType: "audio" | "video" }) => void;
}

const ChatWindow = ({ chatId, onBack, onStartCall }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chatName, setChatName] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUserAvatar, setOtherUserAvatar] = useState<string | null>(null);
  const [otherUserStatus, setOtherUserStatus] = useState<{status: string | null, lastSeen: string | null}>({status: null, lastSeen: null});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
  const [forwardingMessageContent, setForwardingMessageContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; username: string } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showOwnerSettings, setShowOwnerSettings] = useState(false);
  const [chatType, setChatType] = useState<string>("private");
  const [currentUserRole, setCurrentUserRole] = useState<string>("member");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    loadChatInfo();

    const messagesChannel = supabase
      .channel(`messages-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          console.log("[ChatWindow] New message INSERT event:", payload);
          const newMsg = payload.new as any;
          
          // Fetch sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", newMsg.sender_id)
            .single();

          // Fetch replied message if exists
          let replied_message = null;
          if (newMsg.replied_to_message_id) {
            const { data: repliedMsg } = await supabase
              .from("messages")
              .select("content, sender:sender_id(username)")
              .eq("id", newMsg.replied_to_message_id)
              .single();
            replied_message = repliedMsg;
          }

          const messageWithSender = {
            ...newMsg,
            sender: profile,
            read_by: [],
            delivered_to: [],
            replied_message
          };

          setMessages(prev => {
            // Check if message already exists to avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) {
              return prev;
            }
            return [...prev, messageWithSender];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          console.log("[ChatWindow] Message UPDATE event:", payload);
          const updatedMsg = payload.new as any;
          
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMsg.id 
              ? { ...msg, ...updatedMsg, sender: msg.sender }
              : msg
          ));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          console.log("[ChatWindow] Message DELETE event:", payload);
          const deletedMsg = payload.old as any;
          setMessages(prev => prev.filter(msg => msg.id !== deletedMsg.id));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reads",
        },
        async (payload) => {
          console.log("[ChatWindow] Message read INSERT event:", payload);
          const readData = payload.new as any;
          
          setMessages(prev => prev.map(msg => {
            if (msg.id === readData.message_id) {
              const existingReads = msg.read_by || [];
              if (!existingReads.some(r => r.user_id === readData.user_id)) {
                return {
                  ...msg,
                  read_by: [...existingReads, { user_id: readData.user_id }]
                };
              }
            }
            return msg;
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_deliveries",
        },
        async (payload) => {
          console.log("[ChatWindow] Message delivery INSERT event:", payload);
          const deliveryData = payload.new as any;
          
          setMessages(prev => prev.map(msg => {
            if (msg.id === deliveryData.message_id) {
              const existingDeliveries = msg.delivered_to || [];
              if (!existingDeliveries.some(d => d.user_id === deliveryData.user_id)) {
                return {
                  ...msg,
                  delivered_to: [...existingDeliveries, { user_id: deliveryData.user_id }]
                };
              }
            }
            return msg;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [chatId]);

  // Отслеживание онлайн статуса собеседника
  useEffect(() => {
    if (!otherUserId || !currentUserId) return;

    const loadStatus = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("status, last_seen")
        .eq("id", otherUserId)
        .single();
      
      if (data) {
        setOtherUserStatus({
          status: data.status,
          lastSeen: data.last_seen
        });
      }
    };

    loadStatus();

    const statusChannel = supabase
      .channel(`status-${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${otherUserId}`,
        },
        (payload: any) => {
          setOtherUserStatus({
            status: payload.new.status,
            lastSeen: payload.new.last_seen
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
    };
  }, [otherUserId, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChatInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: chat } = await (supabase as any)
        .from("chats")
        .select("name, is_group, chat_type")
        .eq("id", chatId)
        .single();

      if (chat) {
        setChatType(chat.chat_type || "private");
        
        if (chat.is_group) {
          setChatName(chat.name || "Группа");
          
          // Get current user's role
          const { data: memberData } = await supabase
            .from("chat_members")
            .select("role")
            .eq("chat_id", chatId)
            .eq("user_id", user.id)
            .single();
          
          if (memberData) {
            setCurrentUserRole(memberData.role || "member");
          }
        } else {
          const { data: members } = await (supabase as any)
            .from("chat_members")
            .select("user_id")
            .eq("chat_id", chatId)
            .neq("user_id", user.id)
            .single();

          if (members) {
            setOtherUserId(members.user_id);
            const { data: profile } = await (supabase as any)
              .from("profiles")
              .select("username, full_name, avatar_url, status, last_seen")
              .eq("id", members.user_id)
              .single();

            if (profile) {
              setChatName(profile.full_name || profile.username || "Неизвестный");
              setOtherUserAvatar(profile.avatar_url);
              setOtherUserStatus({
                status: profile.status,
                lastSeen: profile.last_seen
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading chat info:", error);
    }
  };

  const loadMessages = async () => {
    try {
      const { data: messagesData } = await (supabase as any)
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (!messagesData) return;

      const messagesWithSenders = await Promise.all(
        messagesData.map(async (message) => {
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", message.sender_id)
            .single();

          // Get read and delivery status
          const { data: reads } = await supabase
            .from("message_reads")
            .select("user_id")
            .eq("message_id", message.id);

          const { data: deliveries } = await supabase
            .from("message_deliveries")
            .select("user_id")
            .eq("message_id", message.id);

          // Get replied message if exists
          let replied_message = null;
          if (message.replied_to_message_id) {
            const { data: repliedMsg } = await supabase
              .from("messages")
              .select("content, sender:sender_id(username)")
              .eq("id", message.replied_to_message_id)
              .single();
            replied_message = repliedMsg;
          }

          return { 
            ...message, 
            sender: profile, 
            read_by: reads || [],
            delivered_to: deliveries || [],
            replied_message 
          };
        })
      );

      setMessages(messagesWithSenders);
      
      // Mark all unread messages as delivered and read
      if (currentUserId) {
        const unreadMessages = messagesData.filter((m: any) => m.sender_id !== currentUserId);
        
        for (const msg of unreadMessages) {
          // Mark as delivered
          await supabase.from("message_deliveries").upsert({
            message_id: msg.id,
            user_id: currentUserId
          }, { onConflict: 'message_id,user_id', ignoreDuplicates: true });
          
          // Mark as read
          await supabase.from("message_reads").upsert({
            message_id: msg.id,
            user_id: currentUserId
          }, { onConflict: 'message_id,user_id', ignoreDuplicates: true });
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async (messages: any[]) => {
    if (!currentUserId) return;

    try {
      // Получаем сообщения, которые не отправлены текущим пользователем
      const otherUserMessages = messages.filter(m => m.sender_id !== currentUserId);
      
      if (otherUserMessages.length === 0) return;

      // Получаем уже прочитанные сообщения
      const { data: existingReads } = await (supabase as any)
        .from("message_reads")
        .select("message_id")
        .in("message_id", otherUserMessages.map(m => m.id))
        .eq("user_id", currentUserId);

      const readMessageIds = new Set(existingReads?.map((r: any) => r.message_id) || []);
      
      // Отмечаем непрочитанные сообщения
      const unreadMessages = otherUserMessages.filter(m => !readMessageIds.has(m.id));
      
      if (unreadMessages.length > 0) {
        const readRecords = unreadMessages.map(m => ({
          message_id: m.id,
          user_id: currentUserId
        }));

        await (supabase as any)
          .from("message_reads")
          .insert(readRecords);
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;
    if (!newMessage.trim() && !selectedFile) return;

    try {
      let fileUrl = null;
      let fileName = null;
      let fileSize = null;
      let fileType = null;

      // Загрузка файла если выбран
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${chatId}/${currentUserId}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        // Store file path instead of public URL - we'll generate signed URLs when needed
        fileUrl = filePath;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        fileType = selectedFile.type;
      }

      // Валидация сообщения если есть текст
      const validatedContent = newMessage.trim() 
        ? messageSchema.parse(newMessage)
        : "";

      if (editingMessageId) {
        // Обновление существующего сообщения
        const { error } = await supabase
          .from("messages")
          .update({
            content: validatedContent,
            edited_at: new Date().toISOString(),
          })
          .eq("id", editingMessageId);

        if (error) throw error;
        toast.success("Сообщение обновлено");
        setEditingMessageId(null);
      } else {
        // Создание нового сообщения
        const { data: insertedMessage, error } = await supabase
          .from("messages")
          .insert({
            chat_id: chatId,
            sender_id: currentUserId,
            content: validatedContent,
            file_url: fileUrl,
            file_name: fileName,
            file_size: fileSize,
            file_type: fileType,
            replied_to_message_id: replyingTo?.id || null,
          })
          .select()
          .single();

        if (error) throw error;

        console.log("[ChatWindow] Message sent successfully:", insertedMessage);

        // Mark message as delivered for the current user immediately
        if (insertedMessage) {
          await supabase.from("message_deliveries").insert({
            message_id: insertedMessage.id,
            user_id: currentUserId,
          });

          // Fetch sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", currentUserId)
            .single();

          // Fetch replied message if exists
          let replied_message = null;
          if (insertedMessage.replied_to_message_id) {
            const { data: repliedMsg } = await supabase
              .from("messages")
              .select("content, sender:sender_id(username)")
              .eq("id", insertedMessage.replied_to_message_id)
              .single();
            replied_message = repliedMsg;
          }

          // Add message to local state immediately
          const messageWithSender = {
            ...insertedMessage,
            sender: profile,
            read_by: [],
            delivered_to: [{ user_id: currentUserId }],
            replied_message
          };

          setMessages(prev => [...prev, messageWithSender]);
        }
      }

      await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId);

      setNewMessage("");
      setSelectedFile(null);
      setReplyingTo(null);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(getUserFriendlyError(error));
      }
    }
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setNewMessage(message.content);
  };

  const handleVoiceRecording = async (audioBlob: Blob) => {
    if (!currentUserId) return;

    try {
      const fileName = `voice-${Date.now()}.webm`;
      const filePath = `${chatId}/${currentUserId}-${Date.now()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
        });

      if (uploadError) throw uploadError;

      const { data: insertedMessage, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: currentUserId,
          content: "🎤 Голосовое сообщение",
          file_url: filePath,
          file_name: fileName,
          file_size: audioBlob.size,
          file_type: 'audio/webm',
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log("[ChatWindow] Voice message sent successfully:", insertedMessage);
      
      // Mark message as delivered for the current user
      if (insertedMessage) {
        await supabase.from("message_deliveries").insert({
          message_id: insertedMessage.id,
          user_id: currentUserId,
        });

        // Fetch sender profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", currentUserId)
          .single();

        // Add message to local state immediately
        const messageWithSender = {
          ...insertedMessage,
          sender: profile,
          read_by: [],
          delivered_to: [{ user_id: currentUserId }],
          replied_message: null
        };

        setMessages(prev => [...prev, messageWithSender]);
      }
      
      setShowVoiceRecorder(false);
    } catch (error: any) {
      toast.error(getUserFriendlyError(error));
    }
  };

  const handleVideoRecording = async (videoBlob: Blob) => {
    if (!currentUserId) return;

    try {
      const fileName = `video-${Date.now()}.webm`;
      const filePath = `${chatId}/${currentUserId}-${Date.now()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, videoBlob, {
          contentType: 'video/webm',
        });

      if (uploadError) throw uploadError;

      const { data: insertedMessage, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: currentUserId,
          content: "🎥 Видеосообщение",
          file_url: filePath,
          file_name: fileName,
          file_size: videoBlob.size,
          file_type: 'video/webm',
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log("[ChatWindow] Video message sent successfully:", insertedMessage);
      
      // Mark message as delivered for the current user
      if (insertedMessage) {
        await supabase.from("message_deliveries").insert({
          message_id: insertedMessage.id,
          user_id: currentUserId,
        });

        // Fetch sender profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", currentUserId)
          .single();

        // Add message to local state immediately
        const messageWithSender = {
          ...insertedMessage,
          sender: profile,
          read_by: [],
          delivered_to: [{ user_id: currentUserId }],
          replied_message: null
        };

        setMessages(prev => [...prev, messageWithSender]);
      }
      
      setShowVideoRecorder(false);
    } catch (error: any) {
      toast.error(getUserFriendlyError(error));
    }
  };

  const handleForwardMessage = async (targetChatId: string) => {
    if (!forwardingMessageId || !currentUserId) return;

    try {
      const originalMessage = messages.find(m => m.id === forwardingMessageId);
      if (!originalMessage) return;

      const { error } = await supabase.from("messages").insert({
        chat_id: targetChatId,
        sender_id: currentUserId,
        content: originalMessage.content,
        file_url: originalMessage.file_url,
        file_name: originalMessage.file_name,
        file_size: originalMessage.file_size,
        file_type: originalMessage.file_type,
        forwarded_from_message_id: originalMessage.id,
        forwarded_from_chat_id: chatId,
      });

      if (error) throw error;

      await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", targetChatId);
    } catch (error: any) {
      toast.error(getUserFriendlyError(error));
      throw error;
    }
  };

  const handleDeleteMessage = async () => {
    if (!deletingMessageId) return;

    try {
      const { error } = await supabase
        .from("messages")
        .update({ is_deleted: true, content: "Сообщение удалено" })
        .eq("id", deletingMessageId);

      if (error) throw error;
      toast.success("Сообщение удалено");
    } catch (error: any) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleStartCall = async (callType: "audio" | "video") => {
    if (!otherUserId || !currentUserId || !chatName) {
      toast.error("Не удалось определить собеседника");
      return;
    }
    
    console.log('[ChatWindow] Starting call:', {
      chatId,
      otherUserId,
      currentUserId,
      chatName,
      callType
    });
    
    // Verify we're still a member of this chat before calling
    try {
      const { data: membership, error } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId)
        .eq('user_id', currentUserId)
        .maybeSingle();
      
      console.log('[ChatWindow] Membership check before call:', { membership, error, chatId, userId: currentUserId });
      
      if (error || !membership) {
        console.error('[ChatWindow] Not a member of this chat, cannot initiate call');
        toast.error('Вы больше не являетесь участником этого чата');
        return;
      }
    } catch (err) {
      console.error('[ChatWindow] Exception during membership check:', err);
      toast.error('Не удалось проверить доступ к чату');
      return;
    }
    
    // Открываем диалог звонка для инициатора
    if (onStartCall) {
      onStartCall({
        chatId: chatId,
        otherUserId: otherUserId,
        otherUserName: chatName,
        callType: callType,
      });
    }
    
    // Send global notification to other user
    const channel = supabase.channel(`global-call-notifications-${otherUserId}`);
    await channel.subscribe();
    await channel.send({
      type: "broadcast",
      event: "incoming-call",
      payload: {
        chatId: chatId,
        callerId: currentUserId,
        callType: callType,
      },
    });
    
    toast.info("Звонок отправлен...");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Загрузка сообщений...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src={otherUserAvatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {(chatName && chatName.charAt(0).toUpperCase()) || "?"}
              </AvatarFallback>
            </Avatar>
            {chatType === "private" && otherUserStatus && isUserOnline(otherUserStatus.lastSeen, otherUserStatus.status) && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-background" />
            )}
          </div>
          <div>
            <h2 className="font-semibold">{chatName || "Неизвестный контакт"}</h2>
            {chatType === "private" && otherUserStatus && (
              <p className="text-xs text-muted-foreground">
                {getLastSeenText(otherUserStatus.lastSeen, otherUserStatus.status)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="w-5 h-5" />
          </Button>
          {chatType !== "private" && (
            <>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowAddMembers(true)}
                title="Добавить участников"
              >
                <Users className="w-5 h-5" />
              </Button>
              {chatType === "channel" && (currentUserRole === "owner" || currentUserRole === "admin") && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowChannelSettings(true)}
                    title="Настройки канала"
                  >
                    <Settings2 className="w-5 h-5" />
                  </Button>
                  {currentUserRole === "owner" && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setShowOwnerSettings(true)}
                      title="Управление владением"
                    >
                      <Crown className="w-5 h-5" />
                    </Button>
                  )}
                </>
              )}
            </>
          )}
          {chatType !== "channel" && (
            <>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleStartCall("audio")}
              >
                <Phone className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleStartCall("video")}
              >
                <Video className="w-5 h-5" />
              </Button>
            </>
          )}
          {chatType !== "channel" && (
            <ChatActions
              chatId={chatId}
              isGroup={chatType === "group"}
              currentUserId={currentUserId}
              onChatDeleted={() => {
                toast.success(chatType === "group" ? "Вы вышли из группы" : "Чат удален");
                if (onBack) onBack();
              }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => {
          const isOwn = message.sender_id === currentUserId;
          const isDeleted = message.is_deleted;
          
          return (
            <div
              key={message.id}
              className={`flex group ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex gap-2 max-w-[70%] ${
                  isOwn ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {!isOwn && (
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={message.sender?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {((message.sender?.full_name || message.sender?.username) && (message.sender.full_name || message.sender.username)!.charAt(0).toUpperCase()) || "?"}
                    </AvatarFallback>
                  </Avatar>
                )}
                  <div className="flex-1">
                    {message.forwarded_from_message_id && (
                      <div className="text-xs text-muted-foreground mb-1 px-2">
                        Переслано
                      </div>
                    )}
                    {message.replied_to_message_id && message.replied_message && (
                      <div className="text-xs bg-muted/50 rounded p-2 mb-1 border-l-2 border-primary">
                        <span className="font-semibold">{message.replied_message.sender?.username}</span>
                        <p className="text-muted-foreground truncate">{message.replied_message.content}</p>
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      } ${isDeleted ? "opacity-60 italic" : ""}`}
                    >
                      <p className="text-sm">{message.content}</p>
                      {message.file_url && !isDeleted && (
                        <MessageAttachment
                          fileUrl={message.file_url}
                          fileName={message.file_name || "file"}
                          fileSize={message.file_size || undefined}
                          fileType={message.file_type || undefined}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 px-2">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </p>
                      {message.edited_at && (
                        <span className="text-xs text-muted-foreground">(ред.)</span>
                      )}
                      <MessageStatus
                        isOwn={isOwn}
                        isRead={message.read_by ? message.read_by.some((read: any) => read.user_id !== message.sender_id) : false}
                        isDelivered={message.delivered_to ? message.delivered_to.length > 0 : false}
                      />
                      {!isDeleted && (
                        <MessageActions
                          onEdit={isOwn ? () => handleEditMessage(message) : undefined}
                          onDelete={isOwn ? () => setDeletingMessageId(message.id) : undefined}
                          onForward={() => {
                            setForwardingMessageId(message.id);
                            setForwardingMessageContent(message.content);
                          }}
                          onReply={() => {
                            setReplyingTo({
                              id: message.id,
                              content: message.content,
                              username: message.sender?.username || "Unknown"
                            });
                          }}
                        />
                      )}
                    </div>
                    {!isDeleted && (
                      <MessageReactions messageId={message.id} />
                    )}
                  </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {showSearch && (
        <MessageSearch
          chatId={chatId}
          onMessageSelect={(messageId) => {
            const element = document.getElementById(`message-${messageId}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-border bg-card space-y-2">
        {replyingTo && (
          <div className="flex items-center gap-2 bg-muted p-2 rounded">
            <Reply className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{replyingTo.username}</p>
              <p className="text-xs text-muted-foreground truncate">{replyingTo.content}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReplyingTo(null)}
            >
              Отменить
            </Button>
          </div>
        )}
        {showVoiceRecorder ? (
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecording}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        ) : showVideoRecorder ? (
          <VideoRecorder
            onRecordingComplete={handleVideoRecording}
            onCancel={() => setShowVideoRecorder(false)}
          />
        ) : (
          <div className="flex gap-2 items-end">
            <FileUpload
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
              onClearFile={() => setSelectedFile(null)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowVoiceRecorder(true)}
              className="h-10 w-10"
            >
              <Mic className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowVideoRecorder(true)}
              className="h-10 w-10"
            >
              <VideoIcon className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={editingMessageId ? "Редактировать сообщение..." : "Введите сообщение..."}
                className="flex-1"
              />
              {editingMessageId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingMessageId(null);
                    setNewMessage("");
                  }}
                  className="mt-1"
                >
                  Отменить редактирование
                </Button>
              )}
            </div>
            <Button type="submit" disabled={!newMessage.trim() && !selectedFile}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </form>

      <ForwardMessageDialog
        open={!!forwardingMessageId}
        onOpenChange={(open) => {
          if (!open) {
            setForwardingMessageId(null);
            setForwardingMessageContent("");
          }
        }}
        messageId={forwardingMessageId || ""}
        messageContent={forwardingMessageContent}
        onForward={handleForwardMessage}
      />

      <AlertDialog open={!!deletingMessageId} onOpenChange={(open) => !open && setDeletingMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сообщение?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Сообщение будет помечено как удаленное.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GroupManagementDialog
        open={showGroupManagement}
        onOpenChange={setShowGroupManagement}
        chatId={chatId}
        chatName={chatName || ""}
        chatType={chatType}
        currentUserRole={currentUserRole}
      />

      <ChannelSettings
        open={showChannelSettings}
        onOpenChange={setShowChannelSettings}
        chatId={chatId}
      />

      <ChannelOwnerSettings
        open={showOwnerSettings}
        onOpenChange={setShowOwnerSettings}
        chatId={chatId}
        onDeleted={onBack}
      />

      <AddGroupMemberDialog
        open={showAddMembers}
        onOpenChange={setShowAddMembers}
        chatId={chatId}
      />
    </div>
  );
};

export default ChatWindow;