export function KeywordChips({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {keywords.map((keyword) => (
        <li
          key={keyword}
          className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-ink"
        >
          {keyword}
        </li>
      ))}
    </ul>
  );
}
