"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card } from "@/components/ui/Card";

const PLACEHOLDER = `Write your notes in **Markdown**...

## Approach
- Use a hash map for O(1) lookups

## Complexity
- Time: O(n)
- Space: O(n)

## Gotchas
- Edge case: empty input
`;

const PROSE_CLASSES = [
  "prose prose-sm dark:prose-invert max-w-none",
  "prose-headings:font-semibold prose-headings:text-gray-800 dark:prose-headings:text-gray-200",
  "prose-h1:text-base prose-h2:text-sm prose-h3:text-sm",
  "prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-p:leading-relaxed",
  "prose-li:text-gray-600 dark:prose-li:text-gray-400",
  "prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:rounded-xl prose-pre:text-xs",
  "prose-blockquote:border-blue-300 dark:prose-blockquote:border-blue-700",
  "prose-strong:text-gray-800 dark:prose-strong:text-gray-200",
  "prose-a:text-blue-600 dark:prose-a:text-blue-400",
  "prose-table:text-xs",
].join(" ");

interface MarkdownNoteProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  saving?: boolean;
  disabled?: boolean;
}

/**
 * Preview-first Markdown notes with an explicit edit mode.
 *
 * The draft is local state and only lifted on save, so a slow network or a
 * background sync can never clobber what the user is typing.
 */
export function MarkdownNote({ value, onSave, saving, disabled }: MarkdownNoteProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [justSaved, setJustSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Adopt external changes only while not editing, to protect in-flight typing.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  const commit = useCallback(async () => {
    if (draft !== value) await onSave(draft);
    setEditing(false);
    setJustSaved(true);
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void commit();
        return;
      }
      if (event.key === "Escape") {
        setDraft(value);
        setEditing(false);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const el = event.currentTarget;
        const { selectionStart: start, selectionEnd: end } = el;
        setDraft(draft.slice(0, start) + "  " + draft.slice(end));
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = start + 2;
        });
      }
    },
    [commit, draft, value]
  );

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">My Notes</h2>
        <div className="flex items-center gap-2">
          {justSaved && <span className="text-xs text-green-500 font-medium">Saved ✓</span>}
          {saving && <span className="text-xs text-blue-500 animate-pulse">Saving…</span>}

          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-xs font-medium">
            <ModeButton active={!editing} disabled={disabled} onClick={() => setEditing(false)}>
              Preview
            </ModeButton>
            <ModeButton active={editing} disabled={disabled} onClick={() => setEditing(true)}>
              Edit
            </ModeButton>
          </div>

          {editing && (
            <button
              type="button"
              onClick={() => void commit()}
              disabled={disabled}
              className="text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            rows={12}
            autoFocus
            aria-label="Markdown notes editor"
            className="w-full text-sm font-mono border-0 px-5 py-4 resize-none focus:outline-none bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-700"
          />
          <p className="absolute bottom-2 right-4 text-[10px] text-gray-300 dark:text-gray-700 select-none pointer-events-none">
            ⌘S save · Esc cancel · Tab indent
          </p>
        </div>
      ) : (
        <div
          className="px-5 py-4 min-h-[120px] group"
          onClick={() => !disabled && setEditing(true)}
          role={disabled ? undefined : "button"}
          tabIndex={disabled ? undefined : 0}
          onKeyDown={(event) => {
            if (!disabled && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              setEditing(true);
            }
          }}
        >
          {value ? (
            <div className={PROSE_CLASSES}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <span className="text-2xl" aria-hidden>
                📝
              </span>
              <p className="text-sm text-gray-400 dark:text-gray-600">No notes yet</p>
              <p className="text-xs text-gray-300 dark:text-gray-700">
                Click to add notes · Supports Markdown
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ModeButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={
        active
          ? "px-3 py-1.5 bg-blue-600 text-white transition-colors"
          : "px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      }
    >
      {children}
    </button>
  );
}
