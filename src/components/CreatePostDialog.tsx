import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Image as ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreatePostDialogProps {
  onCreatePost: (content: string, imageFile?: File) => void;
}

export const CreatePostDialog = ({ onCreatePost }: CreatePostDialogProps) => {
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Ошибка", description: "Файл слишком большой (макс. 10 МБ)", variant: "destructive" });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = () => {
    if (content.trim() || imageFile) {
      onCreatePost(content, imageFile || undefined);
      setContent("");
      setImageFile(null);
      setImagePreview(null);
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
          <DialogTitle className="pr-8">Создать пост</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Что у вас нового? Используйте #хештеги и @упоминания"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
          />
          {imagePreview && (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full rounded-lg" />
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2"
                onClick={handleRemoveImage}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <label>
                <ImageIcon className="w-4 h-4 mr-2" />
                Добавить фото
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </label>
            </Button>
            <Button onClick={handleSubmit} className="flex-1">
              Опубликовать
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
