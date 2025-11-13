import { MoreVertical, Edit, Trash2, Forward, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessageActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onForward?: () => void;
  onReply?: () => void;
}

const MessageActions = ({ onEdit, onDelete, onForward, onReply }: MessageActionsProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Редактировать
          </DropdownMenuItem>
        )}
        {onReply && (
          <DropdownMenuItem onClick={onReply}>
            <Reply className="h-4 w-4 mr-2" />
            Ответить
          </DropdownMenuItem>
        )}
        {onForward && (
          <DropdownMenuItem onClick={onForward}>
            <Forward className="h-4 w-4 mr-2" />
            Переслать
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Удалить
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MessageActions;
