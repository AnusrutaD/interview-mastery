"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PLACEHOLDER = `Write your notes in **Markdown**...

## Approach
- Use a hash map for O(1) lookups

## Complexity
- Time: O(n)
- Space: O(n)

## Gotchas
- Edge case: empty input
`;

export default function MarkdownNote({ value, onChange, onSave, saving, disabled }) {
  const [editing, setEditing] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const handleSave = async () => {
    await onSave();
    setEditing(false);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const handleKeyDown = (e) => {
    // Ctrl/Cmd+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
    // Tab inserts spaces instead of leaving the textarea
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.substring(0, start) + "  " + value.substring(end);
      onChange(next);
      // Restore cursor after React re-renders
      requestAnimationFrame(() => {
        el.selectionStart = start + 2;
        el.selectionEnd   = start + 2;
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">My Notes</h2>
        <div className="flex items-center gap-2">
          {noteSaved && (
            <span className="text-xs text-green-500 font-medium">Saved ✓</span>
          )}
          {saving && (
            <span className="text-xs text-blue-500 animate-pulse">Saving…</span>
          )}

          {/* Mode pills */}
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-xs font-medium">
            <button
              onClick={() => setEditing(false)}
              disabled={disabled}
              className={`px-3 py-1.5 transition-colors ${
                !editing
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={disabled}
              className={`px-3 py-1.5 transition-colors ${
                editing
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Edit
            </button>
          </div>

          {editing && (
            <button
              onClick={handleSave}
              disabled={disabled}
              className="text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {editing ? (
        <div className="relative">
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            rows={12}
            autoFocus
            className="w-full text-sm font-mono border-0 px-5 py-4 resize-none focus:outline-none bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-700"
          />
          <p className="absolute bottom-2 right-4 text-[10px] text-gray-300 dark:text-gray-700 select-none pointer-events-none">
            ⌘S to save · Tab for indent · Markdown supported
          </p>
        </div>
      ) : (
        <div
          className="px-5 py-4 min-h-[120px] cursor-pointer group"
          onClick={() => !disabled && setEditing(true)}
          title="Click to edit"
        >
          {value ? (
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-headings:font-semibold prose-headings:text-gray-800 dark:prose-headings:text-gray-200
              prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
              prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-p:leading-relaxed
              prose-li:text-gray-600 dark:prose-li:text-gray-400
              prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:text-gray-800 dark:prose-code:text-gray-200 prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:rounded-xl prose-pre:text-xs
              prose-blockquote:border-blue-300 dark:prose-blockquote:border-blue-700 prose-blockquote:text-gray-500 dark:prose-blockquote:text-gray-500
              prose-strong:text-gray-800 dark:prose-strong:text-gray-200
              prose-a:text-blue-600 dark:prose-a:text-blue-400
              prose-hr:border-gray-200 dark:prose-hr:border-gray-700
              prose-table:text-xs
              prose-th:bg-gray-50 dark:prose-th:bg-gray-800 prose-th:text-gray-700 dark:prose-th:text-gray-300
              prose-td:text-gray-600 dark:prose-td:text-gray-400
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <span className="text-2xl">📝</span>
              <p className="text-sm text-gray-400 dark:text-gray-600">No notes yet</p>
              <p className="text-xs text-gray-300 dark:text-gray-700">Click to add notes · Supports Markdown</p>
            </div>
          )}

          {/* Hover hint */}
          {!disabled && value && (
            <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-3 opacity-0 group-hover:opacity-100 transition-opacity text-right">
              Click to edit
            </p>
          )}
        </div>
      )}
    </div>
  );
}
