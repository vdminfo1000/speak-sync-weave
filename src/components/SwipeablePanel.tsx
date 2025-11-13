import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Bell, Users, Phone, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SwipeablePanelProps {
  children: React.ReactNode;
  onOpenChatRequests: () => void;
  onOpenCreateGroup: () => void;
  onOpenCallHistory: () => void;
  pendingRequestsCount?: number;
  missedCallsCount?: number;
}

const SwipeablePanel = ({ 
  children,
  onOpenChatRequests,
  onOpenCreateGroup,
  onOpenCallHistory,
  pendingRequestsCount = 0,
  missedCallsCount = 0,
}: SwipeablePanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const TAB_WIDTH = 60;
  const PANEL_WIDTH = 320;
  const THRESHOLD = 0.3;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setCurrentX(e.clientX);
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      
      const deltaX = startX - currentX;
      const screenWidth = window.innerWidth;
      
      if (Math.abs(deltaX) > screenWidth * THRESHOLD) {
        setIsOpen(deltaX > 0);
      }
      
      setIsDragging(false);
      setCurrentX(0);
      setStartX(0);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      setCurrentX(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;
      
      const deltaX = startX - currentX;
      const screenWidth = window.innerWidth;
      
      if (Math.abs(deltaX) > screenWidth * THRESHOLD) {
        setIsOpen(deltaX > 0);
      }
      
      setIsDragging(false);
      setCurrentX(0);
      setStartX(0);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, startX, currentX]);

  const handleDragStart = (clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
    setCurrentX(clientX);
  };

  const getDragOffset = () => {
    if (!isDragging) return 0;
    const deltaX = startX - currentX;
    return Math.max(-PANEL_WIDTH, Math.min(0, -deltaX));
  };

  const menuItems = [
    { 
      icon: MessageSquare, 
      label: "Чаты",
      onClick: () => setIsOpen(false),
      badge: 0
    },
    { 
      icon: Bell, 
      label: "Запросы",
      onClick: onOpenChatRequests,
      badge: pendingRequestsCount
    },
    { 
      icon: Users, 
      label: "Группы",
      onClick: onOpenCreateGroup,
      badge: 0
    },
    { 
      icon: Phone, 
      label: "Звонки",
      onClick: onOpenCallHistory,
      badge: missedCallsCount
    },
  ];

  return (
    <>
      {children}
      
      <div
        ref={panelRef}
        className={cn(
          "fixed top-0 right-0 h-full flex transition-transform duration-300 ease-out z-50",
          isDragging && "transition-none"
        )}
        style={{
          width: isOpen ? `${PANEL_WIDTH}px` : `${TAB_WIDTH}px`,
          transform: isOpen
            ? `translateX(${isDragging ? getDragOffset() : 0}px)`
            : `translateX(0px)`,
        }}
      >
        {/* Tab with icons */}
        <div
          className="w-[60px] bg-primary/10 backdrop-blur-sm border-l border-border flex flex-col items-center justify-center gap-6 py-8 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragStart(e.clientX);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleDragStart(e.touches[0].clientX);
          }}
        >
          {menuItems.map((item, index) => (
            <div
              key={index}
              className="relative flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
              }}
            >
              <div className="relative">
                <item.icon className="h-6 w-6" />
                {item.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Panel Content */}
        {isOpen && (
          <div className="flex-1 bg-background border-l shadow-2xl overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Меню</h2>
              </div>
              <div className="flex-1 p-4 space-y-3">
                {menuItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer transition-colors flex items-center gap-3"
                    onClick={() => {
                      item.onClick();
                      setIsOpen(false);
                    }}
                  >
                    <item.icon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                    {item.badge > 0 && (
                      <Badge variant="destructive" className="h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SwipeablePanel;
