import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useSocialStories, Story } from "@/hooks/useSocialStories";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface StoryViewerProps {
  userId: string;
  stories: Story[];
  onClose: () => void;
}

export const StoryViewer = ({ userId, stories, onClose }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { viewStory } = useSocialStories();
  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (currentStory && !currentStory.is_viewed) {
      viewStory(currentStory.id);
    }
  }, [currentStory, viewStory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentIndex < stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onClose();
      }
    }, 5000); // 5 seconds per story

    return () => clearTimeout(timer);
  }, [currentIndex, stories.length, onClose]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  if (!currentStory) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[90vh] p-0 bg-black">
        <div className="relative h-full">
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
            {stories.map((_, index) => (
              <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-[5000ms] ease-linear"
                  style={{
                    width: index < currentIndex ? "100%" : index === currentIndex ? "100%" : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
            <div className="flex items-center gap-2">
              <Avatar className="w-10 h-10">
                <AvatarImage src={currentStory.profiles?.avatar_url || ""} />
                <AvatarFallback>
                  {currentStory.profiles?.full_name?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-semibold text-sm">
                  {currentStory.profiles?.full_name || currentStory.profiles?.username}
                </p>
                <p className="text-white/70 text-xs">
                  {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true, locale: ru })}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Story media */}
          <div className="h-full flex items-center justify-center">
            {currentStory.media_type === "video" ? (
              <video src={currentStory.media_url} className="max-w-full max-h-full" autoPlay />
            ) : (
              <img src={currentStory.media_url} alt="Story" className="max-w-full max-h-full object-contain" />
            )}
          </div>

          {/* Navigation */}
          <div className="absolute inset-0 flex">
            <button onClick={handlePrevious} className="flex-1" />
            <button onClick={handleNext} className="flex-1" />
          </div>

          {/* Navigation buttons */}
          {currentIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-white"
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
          )}
          {currentIndex < stories.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white"
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          )}

          {/* Content */}
          {currentStory.content && (
            <div className="absolute bottom-20 left-0 right-0 px-4">
              <p className="text-white text-center">{currentStory.content}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};