import { Check, CheckCheck } from "lucide-react";

interface MessageStatusProps {
  isOwn: boolean;
  isRead: boolean;
  isDelivered?: boolean;
}

const MessageStatus = ({ isOwn, isRead, isDelivered = true }: MessageStatusProps) => {
  if (!isOwn) return null;

  return (
    <span className="inline-flex items-center ml-1">
      {isRead ? (
        <CheckCheck className="h-3 w-3 text-primary" />
      ) : isDelivered ? (
        <Check className="h-3 w-3 text-muted-foreground" />
      ) : null}
    </span>
  );
};

export default MessageStatus;
