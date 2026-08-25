import type { ReactNode } from "react";

export function Term({ word, children }: { word: string; children: ReactNode }) {
  return (
    <span className="term" tabIndex={0}>
      {word}
      <span className="tip" role="tooltip">
        {children}
      </span>
    </span>
  );
}

export function NoteWithTerm({ note, word, def }: { note: string; word?: string; def?: string }) {
  if (!word || !def || !note.includes(word)) return <>{note}</>;
  const [before, after] = note.split(word);
  return (
    <>
      {before}
      <Term word={word}>{def}</Term>
      {after}
    </>
  );
}
