function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatMessageTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (isSameDay(date, now)) {
    return `Today ${time}`;
  }

  if (isSameDay(date, yesterday)) {
    return `Yesterday ${time}`;
  }

  const fullDate = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  return `${fullDate} ${time}`;
}
