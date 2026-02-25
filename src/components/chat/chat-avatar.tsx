export function ChatAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string;
}) {
  const fallback = name.slice(0, 1).toUpperCase();

  if (imageUrl) {
    return (
      <div
        role="img"
        aria-label={name}
        className="size-9 rounded-full bg-cover bg-center"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }

  return (
    <div className="flex size-9 items-center justify-center rounded-full bg-neutral-700 text-xs font-semibold text-neutral-100">
      {fallback}
    </div>
  );
}
