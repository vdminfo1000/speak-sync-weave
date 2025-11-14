import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { useSocialStories } from "@/hooks/useSocialStories";
import { StoryViewer } from "./StoryViewer";
import { CreateStoryDialog } from "./CreateStoryDialog";

export const StoriesBar = () => {
  const { stories, isLoading } = useSocialStories();
  const [selectedStoryUserId, setSelectedStoryUserId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Group stories by user
  const groupedStories = stories?.reduce((acc, story) => {
    if (!acc[story.user_id]) {
      acc[story.user_id] = [];
    }
    acc[story.user_id].push(story);
    return {};
  }, {} as Record<string, typeof stories>);

  if (isLoading) return null;

  return (
    <>
      <div className="flex gap-4 p-4 overflow-x-auto scrollbar-hide border-b border-border">
        {/* Create Story Button */}
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex flex-col items-center gap-2 flex-shrink-0"
        >
          <div className="relative">
            <Avatar className="w-16 h-16 border-2 border-dashed border-border">
              <AvatarFallback>
                <Plus className="w-6 h-6" />
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="text-xs text-center max-w-[70px] truncate">Ваша история</span>
        </button>

        {/* Stories from other users */}
        {Object.entries(groupedStories || {}).map(([userId, userStories]) => {
          const firstStory = userStories[0];
          const hasUnviewed = userStories.some(s => !s.is_viewed);

          return (
            <button
              key={userId}
              onClick={() => setSelectedStoryUserId(userId)}
              className="flex flex-col items-center gap-2 flex-shrink-0"
            >
              <div className="relative">
                <Avatar className={`w-16 h-16 ${hasUnviewed ? 'ring-2 ring-primary ring-offset-2' : 'ring-2 ring-muted'}`}>
                  <AvatarImage src={firstStory.profiles?.avatar_url || ""} />
                  <AvatarFallback>
                    {firstStory.profiles?.full_name?.[0] || firstStory.profiles?.username?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="text-xs text-center max-w-[70px] truncate">
                {firstStory.profiles?.full_name || firstStory.profiles?.username || "User"}
              </span>
            </button>
          );
        })}
      </div>

      {selectedStoryUserId && (
        <StoryViewer
          userId={selectedStoryUserId}
          stories={groupedStories?.[selectedStoryUserId] || []}
          onClose={() => setSelectedStoryUserId(null)}
        />
      )}

      <CreateStoryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </>
  );
};