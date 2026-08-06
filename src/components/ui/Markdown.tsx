import ReactMarkdown from "react-markdown";
import {
  MARKDOWN_REHYPE_PLUGINS,
  MARKDOWN_REMARK_PLUGINS,
} from "@/components/ui/markdownPlugins";
import { cn } from "@/lib/cn";

/** Shared prose styling for all rendered markdown (notes + study content). */
export const PROSE = [
  "prose prose-sm dark:prose-invert max-w-none",
  "prose-headings:font-semibold prose-headings:text-gray-800 dark:prose-headings:text-gray-100",
  "prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-sm prose-h3:mt-6",
  "prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-p:leading-relaxed",
  "prose-li:text-gray-600 dark:prose-li:text-gray-300 prose-li:my-0.5",
  "prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:text-xs prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-800",
  "prose-blockquote:border-blue-400 dark:prose-blockquote:border-blue-600 prose-blockquote:not-italic prose-blockquote:text-gray-500 dark:prose-blockquote:text-gray-400",
  "prose-strong:text-gray-800 dark:prose-strong:text-gray-100",
  "prose-a:text-blue-600 dark:prose-a:text-blue-400",
  "prose-table:text-xs prose-th:bg-gray-50 dark:prose-th:bg-gray-800",
  "prose-hr:border-gray-200 dark:prose-hr:border-gray-800",
].join(" ");

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn(PROSE, className)}>
      <ReactMarkdown
        remarkPlugins={MARKDOWN_REMARK_PLUGINS}
        rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
