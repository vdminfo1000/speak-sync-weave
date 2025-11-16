import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image, Video } from "lucide-react";
import { useSocialStories } from "@/hooks/useSocialStories";
import { toast } from "sonner";

interface CreateStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateStoryDialog = ({ open, onOpenChange }: CreateStoryDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const { createStory } = useSocialStories();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB
        toast.error("Файл слишком большой. Максимум 50МБ");
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleCreate = () => {
    if (!file) {
      toast.error("Выберите файл");
      return;
    }

    createStory({ file, content });
    onOpenChange(false);
    setFile(null);
    setContent("");
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-8">Создать историю</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Медиа</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="relative" asChild>
                <label className="cursor-pointer">
                  <Image className="w-4 h-4 mr-2" />
                  Изображение
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </Button>
              <Button variant="outline" className="relative" asChild>
                <label className="cursor-pointer">
                  <Video className="w-4 h-4 mr-2" />
                  Видео
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          </div>

          {preview && (
            <div className="rounded-lg overflow-hidden">
              {file?.type.startsWith("video") ? (
                <video src={preview} controls className="w-full max-h-64" />
              ) : (
                <img src={preview} alt="Preview" className="w-full max-h-64 object-cover" />
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">Текст (необязательно)</Label>
            <Input
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Добавьте описание..."
            />
          </div>

          <Button onClick={handleCreate} disabled={!file} className="w-full">
            Опубликовать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};