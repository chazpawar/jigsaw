export const ONLINE_WINDOW_MS = 30_000;
export const AUTO_SCROLL_THRESHOLD = 48;
export const REACTION_SET = ["👍", "❤️", "😂", "😮", "😢"] as const;

export function isOnlineNow(lastSeenAt?: number, isOnline?: boolean) {
  if (!isOnline || !lastSeenAt) {
    return false;
  }

  return Date.now() - lastSeenAt < ONLINE_WINDOW_MS;
}

export function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function formatFileSize(size?: number) {
  if (!size || size <= 0) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function previewText(value: string, limit = 72) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Attachment";
  }

  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}
