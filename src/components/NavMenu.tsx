import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu, MessageCircle, Users, Phone, Bell } from "lucide-react";

interface NavMenuProps {
  onOpenChatRequests: () => void;
  onOpenCreateGroup: () => void;
  onOpenCallHistory: () => void;
  pendingRequestsCount?: number;
  missedCallsCount?: number;
}

export const NavMenu = ({
  onOpenChatRequests,
  onOpenCreateGroup,
  onOpenCallHistory,
  pendingRequestsCount = 0,
  missedCallsCount = 0,
}: NavMenuProps) => {
  const [open, setOpen] = useState(false);

  const handleItemClick = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Menu className="h-5 w-5" />
          {(pendingRequestsCount > 0 || missedCallsCount > 0) && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {pendingRequestsCount + missedCallsCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Меню</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleItemClick(onOpenChatRequests)}>
          <MessageCircle className="mr-2 h-4 w-4" />
          <span>Запросы на чат</span>
          {pendingRequestsCount > 0 && (
            <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {pendingRequestsCount}
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleItemClick(onOpenCreateGroup)}>
          <Users className="mr-2 h-4 w-4" />
          <span>Создать группу/канал</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleItemClick(onOpenCallHistory)}>
          <Phone className="mr-2 h-4 w-4" />
          <span>История звонков</span>
          {missedCallsCount > 0 && (
            <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {missedCallsCount}
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
