import { useEffect, useRef, useMemo } from 'react';

interface LrcLine {
  timeSec: number;
  text: string;
}

function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = [];
  const lineRegex = /^\[(\d{1,2}):(\d{2})(?:[.:]\d+)?\](.*)/;
  for (const raw of lrc.split('\n')) {
    const m = raw.match(lineRegex);
    if (!m) continue;
    const timeSec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const text = m[3].trim();
    if (text) lines.push({ timeSec, text });
  }
  return lines.sort((a, b) => a.timeSec - b.timeSec);
}

function getActiveIndex(lines: LrcLine[], positionSec: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeSec <= positionSec) idx = i;
    else break;
  }
  return idx;
}

interface LyricsDisplayProps {
  lyrics?: string;
  positionSec: number;
}

export default function LyricsDisplay({ lyrics, positionSec }: LyricsDisplayProps) {
  const lines  = useMemo(() => (lyrics ? parseLrc(lyrics) : []), [lyrics]);
  const active = getActiveIndex(lines, positionSec);
  const activeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [active]);

  if (!lyrics || lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-text-secondary" data-testid="lyrics-empty">
        <span className="text-[32px] tracking-widest opacity-50">...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="lyrics-lines">
      {lines.map((line, i) => {
        const isActive = i === active;
        return (
          <p
            key={i}
            ref={isActive ? activeRef : undefined}
            data-testid={isActive ? 'lyrics-active-line' : undefined}
            className={
              isActive
                ? 'text-[18px] font-[600] leading-[1.3] text-text-emphasis tracking-tight transition-all'
                : 'text-[14px] leading-[1.5] text-text-secondary opacity-70 transition-all'
            }
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
}
