"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Flag, Loader2 } from "lucide-react";

interface SearchResult {
  _id: string;
  title: string;
  cardNumber?: number;
  status: string;
  priority: string;
  projectId: string;
  projectName?: string;
  projectColor?: string;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
        setSelectedIdx(0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 200);
  };

  const navigate = (result: SearchResult) => {
    setOpen(false);
    router.push(`/projects/${result.projectId}/cards/${result._id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      navigate(results[selectedIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[200]" onClick={() => setOpen(false)} />
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-[201] w-full max-w-lg px-4">
        <div className="bg-bg-surface rounded-2xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search size={18} className="text-text-disabled flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search cards across all boards..."
              className="flex-1 text-sm bg-transparent text-text-primary placeholder:text-text-disabled outline-none"
            />
            {loading && <Loader2 size={16} className="animate-spin text-text-disabled" />}
            <kbd className="hidden sm:inline text-xs text-text-disabled bg-bg-base px-1.5 py-0.5 rounded font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {results.length > 0 ? (
              <div className="py-1">
                {results.map((r, i) => (
                  <button
                    key={r._id}
                    onClick={() => navigate(r)}
                    onMouseEnter={() => setSelectedIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selectedIdx ? "bg-bg-card" : "hover:bg-bg-card"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[r.priority] || "bg-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {r.cardNumber && (
                          <span className="text-xs text-text-disabled font-mono">
                            SP-{r.cardNumber}
                          </span>
                        )}
                        <span className="text-sm text-text-primary font-medium truncate">
                          {r.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {r.projectColor && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: r.projectColor }}
                          />
                        )}
                        <span className="text-xs text-text-disabled truncate">
                          {r.projectName || "Unknown board"} · {r.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : query.trim() && !loading ? (
              <div className="py-8 text-center text-sm text-text-disabled">
                No cards found
              </div>
            ) : !query.trim() ? (
              <div className="py-8 text-center text-sm text-text-disabled">
                Type to search cards, card numbers (SP-xxx), or assignees
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

export function SearchTrigger() {
  const [, setOpen] = useState(false);

  // This is a dummy — actual open state is inside GlobalSearch
  // We dispatch a keyboard event to trigger it
  const triggerOpen = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    <button
      onClick={triggerOpen}
      className="flex items-center gap-2 px-2.5 py-1.5 text-text-disabled hover:text-text-secondary hover:bg-bg-card rounded-lg transition-colors text-sm"
      title="Search (⌘K)"
    >
      <Search size={15} />
      <span className="hidden lg:inline">Search</span>
      <kbd className="hidden lg:inline text-xs bg-bg-base px-1.5 py-0.5 rounded font-mono ml-1">
        ⌘K
      </kbd>
    </button>
  );
}
