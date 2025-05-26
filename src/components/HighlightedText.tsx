import { SearchResultMatch } from "../state";

interface HighlightedTextProps {
  text: string;
  matches?: SearchResultMatch[];
}

export default function HighlightedText({
  text,
  matches,
}: HighlightedTextProps) {
  if (!matches || matches.length === 0) return <span>{text}</span>;

  // Find matches for the entry name
  const nameMatches = matches.find((m) => m.key === "entry.name");

  if (nameMatches && nameMatches.indices) {
    // Apply highlighting to matched characters
    return (
      <span>
        {text.split("").map((char, index) => {
          const isHighlighted = nameMatches.indices.some(
            ([start, end]) => index >= start && index <= end,
          );
          return isHighlighted ? (
            <mark key={index} className="bg-yellow-200 dark:bg-yellow-800">
              {char}
            </mark>
          ) : (
            char
          );
        })}
      </span>
    );
  }

  return <span>{text}</span>;
}
