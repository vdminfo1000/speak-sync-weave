import { useState, useEffect } from "react";
import { FileIcon, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSignedFileUrl, extractFilePathFromUrl, getFileCategory } from "@/utils/fileStorage";

interface MessageAttachmentProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
}

const MessageAttachment = ({ fileUrl, fileName, fileSize, fileType }: MessageAttachmentProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSignedUrl = async () => {
      setIsLoading(true);
      
      // Extract file path from URL
      const filePath = extractFilePathFromUrl(fileUrl);
      
      if (!filePath) {
        console.error("Could not extract file path from URL:", fileUrl);
        setSignedUrl(fileUrl); // Fallback to original URL
        setIsLoading(false);
        return;
      }

      // Generate signed URL for private bucket
      const signed = await getSignedFileUrl('message-attachments', filePath, 3600);
      setSignedUrl(signed || fileUrl);
      setIsLoading(false);
    };

    loadSignedUrl();
  }, [fileUrl]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const fileCategory = getFileCategory(fileType);

  const handleDownload = async () => {
    if (!signedUrl) return;
    
    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Загрузка...</span>
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className="mt-2 flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
        <FileIcon className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Файл недоступен</span>
      </div>
    );
  }

  return (
    <div className="mt-2 max-w-xs">
      {fileCategory === 'image' && (
        <div className="relative group">
          <img
            src={signedUrl}
            alt={fileName}
            className="rounded-lg max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(signedUrl, "_blank")}
          />
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}

      {fileCategory === 'video' && (
        <div className="relative group">
          <video
            src={signedUrl}
            controls
            className="rounded-lg max-h-64 w-full"
          />
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}

      {fileCategory === 'audio' && (
        <div className="flex flex-col gap-2 p-3 bg-secondary/50 rounded-lg">
          <div className="flex items-center gap-2">
            <FileIcon className="h-6 w-6 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              {fileSize && (
                <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
              )}
            </div>
            <Button size="icon" variant="ghost" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <audio src={signedUrl} controls className="w-full h-10" />
        </div>
      )}

      {fileCategory === 'document' && (
        <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
          <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            {fileSize && (
              <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
            )}
          </div>
          <Button size="icon" variant="ghost" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MessageAttachment;
