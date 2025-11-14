import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

interface CreatePostDialogProps {
  onCreatePost: (content: string) => void;
}

export const CreatePostDialog = ({ onCreatePost }: CreatePostDialogProps) => {
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (content.trim()) {
      onCreatePost(content);
      setContent("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon">
          <Plus className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать пост</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Что у вас нового?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
          />
          <Button onClick={handleSubmit} className="w-full">
            Опубликовать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
