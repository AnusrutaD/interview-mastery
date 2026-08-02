"use client";
import { useMemo, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * Suggestions only — a convenience for fast entry, not a claim about which
 * companies actually ask this problem. Anything can be typed.
 */
const COMMON_COMPANIES = [
  "Amazon",
  "Google",
  "Meta",
  "Microsoft",
  "Apple",
  "Netflix",
  "Uber",
  "Adobe",
  "Bloomberg",
  "Atlassian",
  "Salesforce",
  "Oracle",
  "LinkedIn",
  "Stripe",
  "Goldman Sachs",
  "Flipkart",
  "Swiggy",
  "Zomato",
  "Razorpay",
  "PhonePe",
  "Walmart",
  "Infosys",
  "TCS",
  "Wipro",
] as const;

interface CompanyTagsProps {
  value: string[];
  onChange: (companies: string[]) => void | Promise<void>;
  disabled?: boolean;
  saving?: boolean;
}

/** Title-case so "meta", "META" and "Meta" do not become three distinct tags. */
function normalise(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function CompanyTags({ value, onChange, disabled, saving }: CompanyTagsProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const query = draft.trim().toLowerCase();
    const taken = new Set(value.map((c) => c.toLowerCase()));
    return COMMON_COMPANIES.filter(
      (c) => !taken.has(c.toLowerCase()) && (query === "" || c.toLowerCase().includes(query))
    ).slice(0, 6);
  }, [draft, value]);

  const add = (raw: string) => {
    const company = normalise(raw);
    if (!company) return;
    if (value.some((c) => c.toLowerCase() === company.toLowerCase())) {
      setDraft("");
      return;
    }
    void onChange([...value, company].sort((a, b) => a.localeCompare(b)));
    setDraft("");
    setOpen(false);
  };

  const remove = (company: string) => {
    void onChange(value.filter((c) => c !== company));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
      return;
    }
    // Backspace on an empty field removes the last tag — standard chip-input behaviour.
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value[value.length - 1]);
    }
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Asked at
        </p>
        {saving && <span className="text-[10px] text-blue-500 animate-pulse">Saving…</span>}
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {value.map((company) => (
          <span
            key={company}
            className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded-full"
          >
            {company}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(company)}
                aria-label={`Remove ${company}`}
                className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors leading-none"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {!disabled && (
          <div className="relative">
            <input
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              placeholder={value.length === 0 ? "Add a company…" : "Add…"}
              aria-label="Add a company where you were asked this problem"
              className="text-xs bg-transparent border border-dashed border-gray-300 dark:border-gray-600 rounded-full px-3 py-1 w-32 focus:w-44 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 transition-all"
            />

            {open && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 left-0 min-w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((company) => (
                  <li key={company}>
                    <button
                      type="button"
                      // mouseDown fires before the input's blur, so the click lands.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        add(company);
                      }}
                      className="w-full text-left text-xs px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    >
                      {company}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {disabled && value.length === 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-600">Sign in to tag companies</span>
        )}
      </div>

      {value.length === 0 && !disabled && (
        <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-1.5">
          Tag problems you&apos;ve actually been asked — your own record, not scraped data.
        </p>
      )}
    </div>
  );
}

/** Read-only chips for list views. */
export function CompanyChips({ companies, max = 3 }: { companies: string[]; max?: number }) {
  if (companies.length === 0) return null;
  const shown = companies.slice(0, max);
  const extra = companies.length - shown.length;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {shown.map((company) => (
        <span
          key={company}
          className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
            "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
          )}
        >
          {company}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-gray-400 dark:text-gray-600">+{extra}</span>
      )}
    </span>
  );
}
