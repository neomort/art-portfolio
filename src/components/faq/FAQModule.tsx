import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { marked } from 'marked';
import { Plus, Minus, Search as SearchIcon } from 'lucide-react';

export type FAQModuleProps = {
  categorySlugs?: string[];
  tagFilter?: string[];
  limit?: number;
  searchPlaceholder?: string;
  // If provided, component becomes controlled for search query
  query?: string;
  onQueryChange?: (q: string) => void;
  // Hide the built-in search input; useful when rendering search externally
  hideSearch?: boolean;
};

type Category = { id: string; slug: string; title: string; position: number };
type Entry = {
  id: string;
  category_id: string | null;
  question: string;
  answer_md: string;
  tags: string[];
  position: number;
};

const stripMarkdown = (md: string) => md.replace(/[#*_`>\-]|\!\[[^\]]*\]\([^\)]*\)/g, '');

// Highlight helpers
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const highlightHTML = (html: string, query: string) => {
  if (!query) return html;
  try {
    const pattern = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    return html.replace(pattern, '<mark>$1</mark>');
  } catch {
    return html;
  }
};
const renderHighlightedText = (text: string, query: string): (string | JSX.Element)[] => {
  if (!query) return [text];
  try {
    const pattern = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const parts = text.split(pattern);
    return parts.map((part, i) =>
      pattern.test(part) ? (
        <mark key={i}>{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  } catch {
    return [text];
  }
};

const FAQModule: React.FC<FAQModuleProps> = ({ categorySlugs, tagFilter, limit, searchPlaceholder, query, onQueryChange, hideSearch }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  // Prefer controlled prop if provided
  const derivedQ: string = typeof query === 'string' ? query : q;

  useEffect(() => {
    // Disabled for art portfolio - faq_categories/faq_entries tables not present
    setCategories([]);
    setEntries([]);
    setLoading(false);
  }, [JSON.stringify(categorySlugs), JSON.stringify(tagFilter), limit]);

  const filtered = useMemo(() => {
    if (!derivedQ) return entries;
    const needle = derivedQ.toLowerCase();
    return entries.filter(e =>
      e.question.toLowerCase().includes(needle)
      || stripMarkdown(e.answer_md).toLowerCase().includes(needle)
      || (Array.isArray(e.tags) && e.tags.some(t => (t || '').toLowerCase().includes(needle)))
    );
  }, [entries, derivedQ]);

  const grouped = useMemo(() => {
    const map: Record<string, { category: Category | undefined; items: Entry[] }> = {};
    const catsById = new Map(categories.map(c => [c.id, c] as const));
    for (const e of filtered) {
      const key = e.category_id || 'uncategorized';
      if (!map[key]) map[key] = { category: catsById.get(e.category_id || '') as any, items: [] };
      map[key].items.push(e);
    }
    // Sort groups by category position
    const order = categories.map(c => c.id);
    const arr = Object.entries(map).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    return arr.map(([, v]) => v);
  }, [filtered, categories]);

  const toggle = (id: string) => setOpenIds(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div className="py-8 text-center text-maroon-600">Loading FAQ…</div>;
  if (error) return <div className="py-8 text-center text-red-600">{error}</div>;

  return (
    <div>
      {!hideSearch && (
        <div className="mb-6">
          <div className="relative max-w-xl">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              className="pl-9 pr-3 py-2 w-full border-2 border-maroon-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
              placeholder={searchPlaceholder || 'Search questions and answers'}
              value={derivedQ}
              onChange={(e) => (onQueryChange ? onQueryChange(e.target.value) : setQ(e.target.value))}
            />
          </div>
        </div>
      )}

      {grouped.length === 0 && (
        <div className="text-center text-maroon-600">No matching questions.</div>
      )}

      <div className="space-y-12">
        {grouped.map((group, gi) => (
          <section key={gi}>
            {group.category && (
              <h2 className="text-3xl font-bold text-maroon-800 mb-6 font-display text-center">
                {group.category.title}
              </h2>
            )}
            <div className="divide-y divide-maroon-100">
              {group.items.map((item) => {
                // If a search query is present, auto-expand all results
                const open = derivedQ ? true : !!openIds[item.id];
                const rendered = open ? marked.parse(item.answer_md || '') : '';
                const renderedWithHighlight = derivedQ && open ? highlightHTML(rendered as string, derivedQ) : rendered;
                return (
                  <div key={item.id} className="py-4">
                    <button
                      className="w-full flex items-center justify-between text-left hover:text-maroon-700"
                      onClick={() => toggle(item.id)}
                      aria-expanded={open}
                    >
                      <span className="text-lg text-maroon-800">{derivedQ ? renderHighlightedText(item.question, derivedQ) : item.question}</span>
                      {open ? (
                        <Minus className="h-5 w-5 text-maroon-600" />
                      ) : (
                        <Plus className="h-5 w-5 text-maroon-600" />
                      )}
                    </button>
                    {open && (
                      <div className="mt-3 prose prose-maroon max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: renderedWithHighlight as string }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default FAQModule;
