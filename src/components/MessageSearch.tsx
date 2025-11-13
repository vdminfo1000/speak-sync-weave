import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface MessageSearchProps {
  chatId: string;
  onMessageSelect: (messageId: string) => void;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  profiles: {
    username: string;
  };
}

const MessageSearch = ({ chatId, onMessageSelect, onClose }: MessageSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        sender_id,
        profiles:sender_id (username)
      `)
      .eq("chat_id", chatId)
      .ilike("content", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Ошибка поиска");
      setLoading(false);
      return;
    }

    setResults(data as any);
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full bg-background border-l">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Поиск сообщений</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Поиск..."
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading} size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {results.length === 0 && query && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ничего не найдено
            </p>
          )}
          {results.map((result) => (
            <div
              key={result.id}
              className="p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
              onClick={() => {
                onMessageSelect(result.id);
                onClose();
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {result.profiles.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(result.created_at)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {result.content}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MessageSearch;
