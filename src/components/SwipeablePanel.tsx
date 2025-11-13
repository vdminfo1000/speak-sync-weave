import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Bell, Users, Settings, Home, MessageSquare, Phone } from "lucide-react";

interface SwipeablePanelProps {
  children: React.ReactNode;
}

const SwipeablePanel = ({ children }: SwipeablePanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const TAB_WIDTH = 48;
  const THRESHOLD = 0.37;

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
    const screenWidth = window.innerWidth;
    return Math.max(-screenWidth, Math.min(0, -deltaX));
  };

  const closedIcons = [
    { icon: Bell, number: 3 },
    { icon: Users, number: 4 },
    { icon: Settings, number: 5 },
  ];

  const openIcons = [
    { icon: Home, number: 1 },
    { icon: MessageSquare, number: 2 },
    { icon: Phone, number: 3 },
  ];

  const currentIcons = isOpen ? openIcons : closedIcons;

  return (
    <>
      <div className="pr-12">
        {children}
      </div>
      
      <div
        ref={panelRef}
        className={cn(
          "fixed top-0 right-0 h-full flex transition-transform duration-300 ease-out z-50",
          isDragging && "transition-none"
        )}
        style={{
          width: isOpen ? '100vw' : `${TAB_WIDTH}px`,
          transform: isOpen
            ? `translateX(${isDragging ? getDragOffset() : 0}px)`
            : `translateX(0px)`,
        }}
      >
        {/* Tab */}
        <div
          className="w-12 bg-primary/10 backdrop-blur-sm border-l border-border flex flex-col items-center justify-center gap-4 py-8 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragStart(e.clientX);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleDragStart(e.touches[0].clientX);
          }}
        >
          {currentIcons.map((item, index) => (
            <div
              key={index}
              className="relative flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-semibold">{item.number}</span>
            </div>
          ))}
        </div>

        {/* Panel Content */}
        {isOpen && (
          <div className="flex-1 bg-background border-l shadow-2xl overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Боковая панель</h2>
              </div>
              <div className="flex-1 p-4 space-y-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm">Контент панели</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm">Дополнительная информация</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm">Настройки</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SwipeablePanel;
