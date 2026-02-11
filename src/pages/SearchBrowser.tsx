import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Globe, RefreshCw, ArrowRight, Home, ExternalLink, X } from "lucide-react";

const SearchBrowser = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [url, setUrl] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check for URL parameter from chat links
  useEffect(() => {
    const linkUrl = searchParams.get("url");
    if (linkUrl) {
      navigateToUrl(linkUrl);
    }
  }, [searchParams]);

  const normalizeUrl = (input: string): string => {
    let trimmed = input.trim();
    if (!trimmed) return "";
    
    // If it looks like a search query (no dots or spaces), use Google
    if (!trimmed.includes(".") || trimmed.includes(" ")) {
      return `https://www.google.com/search?igu=1&q=${encodeURIComponent(trimmed)}`;
    }
    
    // Add https if no protocol
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      trimmed = "https://" + trimmed;
    }
    
    return trimmed;
  };

  const navigateToUrl = (rawUrl: string) => {
    const normalized = normalizeUrl(rawUrl);
    if (!normalized) return;
    
    setUrl(normalized);
    setInputValue(rawUrl);
    setIsLoading(true);
    
    setHistory(prev => {
      const newHistory = [...prev.slice(0, historyIndex + 1), normalized];
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToUrl(inputValue);
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setUrl(history[newIndex]);
      setInputValue(history[newIndex]);
    }
  };

  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setUrl(history[newIndex]);
      setInputValue(history[newIndex]);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && url) {
      setIsLoading(true);
      iframeRef.current.src = url;
    }
  };

  const handleHome = () => {
    setUrl("");
    setInputValue("");
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-2 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/messenger")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {/* Navigation buttons */}
        <Button variant="ghost" size="icon" className="shrink-0" onClick={handleGoBack} disabled={historyIndex <= 0}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={handleGoForward} disabled={historyIndex >= history.length - 1}>
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={handleRefresh}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={handleHome}>
          <Home className="w-4 h-4" />
        </Button>

        {/* URL bar */}
        <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Введите адрес или поисковый запрос..."
              className="pl-9 pr-8"
            />
            {inputValue && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setInputValue("")}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          <Button type="submit" size="icon" className="shrink-0">
            <Search className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {url ? (
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            title="Browser"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Globe className="w-24 h-24 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-bold mb-2">Поиск</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Введите адрес сайта или поисковый запрос в строку выше
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["google.com", "youtube.com", "wikipedia.org"].map((site) => (
                <Button
                  key={site}
                  variant="outline"
                  className="gap-2"
                  onClick={() => navigateToUrl(site)}
                >
                  <ExternalLink className="w-4 h-4" />
                  {site}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20">
            <div className="h-full bg-primary animate-pulse w-1/2" />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBrowser;
