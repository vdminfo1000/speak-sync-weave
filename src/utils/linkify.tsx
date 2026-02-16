import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+\.[^\s<>"']+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s<>"']*)?)/gi;

export const linkifyContent = (text: string, navigate: (path: string) => void) => {
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    URL_REGEX.lastIndex = 0;
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/search?url=${encodeURIComponent(href)}`);
          }}
          className="underline font-medium opacity-90 hover:opacity-100 break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};
