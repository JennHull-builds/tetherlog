import { FileCard, type FileTone } from "./ui";

const PEEK_TONES: FileTone[] = ["wonder", "later", "now"];

export interface LogStackProps {
  className?: string;
}

/** Brutalist offset stack — peek cards behind capture hero. */
export function LogStack({ className = "" }: LogStackProps) {
  return (
    <div
      className={`relative mx-auto h-20 w-[62%] max-w-[15rem] ${className}`}
      aria-hidden
    >
      {PEEK_TONES.map((tone, index) => (
        <FileCard
          key={tone}
          tone={tone}
          peek
          compact
          className="absolute inset-x-0"
          style={{
            top: `${index * 6}px`,
            left: `${index * 5}px`,
            zIndex: index,
          }}
        />
      ))}
    </div>
  );
}
