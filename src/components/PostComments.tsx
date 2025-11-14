import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface PostCommentsProps {
  postId: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export const PostComments = ({ postId }: PostCommentsProps) => {
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", userIds);

      const enrichedComments: Comment[] = data.map(comment => ({
        ...comment,
        profiles: profiles?.find(p => p.id === comment.user_id),
      }));

      return enrichedComments;
    },
  });

  const createComment = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("social_comments")
        .insert({ post_id: postId, user_id: user.id, content });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
      setCommentText("");
    },
    onError: () => {
      toast.error("Не удалось добавить комментарий");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      createComment.mutate(commentText);
    }
  };

  return (
    <div className="space-y-4">
      <ScrollArea className="max-h-64">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Загрузка...</p>
        ) : comments && comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={comment.profiles?.avatar_url || ""} />
                  <AvatarFallback>
                    {comment.profiles?.full_name?.[0] || comment.profiles?.username?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-muted p-2 rounded-lg">
                    <p className="text-sm font-semibold">
                      {comment.profiles?.full_name || comment.profiles?.username || "Пользователь"}
                    </p>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ru })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Пока нет комментариев</p>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Напишите комментарий..."
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!commentText.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
};