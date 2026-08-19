import { FileCard, type FileTone } from "./ui";

const PEEK_TONES: FileTone[] = ["wonder", "later", "now"];

export interface LogStackProps {
  className?: string;
}

export function LogStack({ className = "" }: LogStackProps) {
  return (
    <div className={`relative h-28 ${className}`} aria-hidden>
      {PEEK_TONES.map((tone, index) => (
        <FileCard
          key={tone}
          tone={tone}
          peek
          className="absolute inset-x-4"
          style={{
            top: `${index * 0.7}rem`,
            transform: `rotate(${(index - 1) * 2.4}deg)`,
            zIndex: index,
          }}
        />
      ))}
    </div>
  );
}
