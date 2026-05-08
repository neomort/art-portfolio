import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { PlusCircle, Trash2, Edit } from 'lucide-react';

type Category = { id: string; slug: string; title: string; position: number };

type Entry = {
  id: string;
  category_id: string | null;
  question: string;
  answer_md: string;
  tags: string[];
  position: number;
  published: boolean;
};

const AdminFAQManager: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New category form
  const [catTitle, setCatTitle] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catPos, setCatPos] = useState<number>(10);

  // Edit category form
  const [editingCatId, setEditingCatId] = useState<string>('');
  const [editCatTitle, setEditCatTitle] = useState('');
  const [editCatSlug, setEditCatSlug] = useState('');
  const [editCatPos, setEditCatPos] = useState<number>(0);
  // Inline delete confirm state for categories
  const [confirmCatDeleteId, setConfirmCatDeleteId] = useState<string>('');

  // New entry form
  const [eCategoryId, setECategoryId] = useState<string>('');
  const [eQuestion, setEQuestion] = useState('');
  const [eAnswer, setEAnswer] = useState('');
  const [eTags, setETags] = useState('');
  const [ePos, setEPos] = useState<number>(10);
  const [ePublished, setEPublished] = useState(true);

  // Edit entry form
  const [editingEntryId, setEditingEntryId] = useState<string>('');
  const [edCategoryId, setEdCategoryId] = useState<string>('');
  const [edQuestion, setEdQuestion] = useState('');
  const [edAnswer, setEdAnswer] = useState('');
  const [edTags, setEdTags] = useState('');
  const [edPos, setEdPos] = useState<number>(0);
  const [edPublished, setEdPublished] = useState(true);
  // Inline delete confirm state for entries
  const [confirmEntryDeleteId, setConfirmEntryDeleteId] = useState<string>('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: cats, error: catErr }, { data: ents, error: entErr }] = await Promise.all([
        supabase.from('faq_categories').select('*').order('position', { ascending: true }),
        supabase.from('faq_entries').select('*').order('position', { ascending: true })
      ]);
      if (catErr) throw catErr;
      if (entErr) throw entErr;
      setCategories(cats || []);
      setEntries(ents || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load FAQ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Database['public']['Tables']['faq_categories']['Insert'] = {
      title: catTitle,
      slug: catSlug,
      position: catPos,
    };
    const { error } = await supabase
      .from('faq_categories')
      .insert(payload);
    if (error) return alert(error.message);
    setCatTitle(''); setCatSlug(''); setCatPos(10);
    load();
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from('faq_categories').delete().eq('id', id);
    if (error) return alert(error.message);
    load();
  };

  const beginEditCategory = (c: Category) => {
    setEditingCatId(c.id);
    setEditCatTitle(c.title);
    setEditCatSlug(c.slug);
    setEditCatPos(c.position ?? 10);
  };

  const cancelEditCategory = () => {
    setEditingCatId('');
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCatId) return;
    const updates: Database['public']['Tables']['faq_categories']['Update'] = {
      title: editCatTitle,
      slug: editCatSlug,
      position: editCatPos,
    };
    const { error } = await supabase
      .from('faq_categories')
      .update(updates)
      .eq('id', editingCatId);
    if (error) return alert(error.message);
    setEditingCatId('');
    load();
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = eTags.split(',').map(t => t.trim()).filter(Boolean);
    const payload: Database['public']['Tables']['faq_entries']['Insert'] = {
      category_id: eCategoryId || null,
      question: eQuestion,
      answer_md: eAnswer,
      tags,
      position: ePos,
      published: ePublished,
    };
    const { error } = await supabase
      .from('faq_entries')
      .insert(payload);
    if (error) return alert(error.message);
    setECategoryId(''); setEQuestion(''); setEAnswer(''); setETags(''); setEPos(10); setEPublished(true);
    load();
  };

  const handleDeleteEntry = async (id: string) => {
    const { error } = await supabase.from('faq_entries').delete().eq('id', id);
    if (error) return alert(error.message);
    load();
  };

  const beginEditEntry = (en: Entry) => {
    setEditingEntryId(en.id);
    setEdCategoryId(en.category_id || '');
    setEdQuestion(en.question);
    setEdAnswer(en.answer_md);
    setEdTags((en.tags || []).join(', '));
    setEdPos(en.position ?? 10);
    setEdPublished(!!en.published);
  };

  const cancelEditEntry = () => {
    setEditingEntryId('');
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntryId) return;
    const tags = edTags.split(',').map(t => t.trim()).filter(Boolean);
    const updates: Database['public']['Tables']['faq_entries']['Update'] = {
      category_id: edCategoryId || null,
      question: edQuestion,
      answer_md: edAnswer,
      tags,
      position: edPos,
      published: edPublished,
    };
    const { error } = await supabase
      .from('faq_entries')
      .update(updates)
      .eq('id', editingEntryId);
    if (error) return alert(error.message);
    setEditingEntryId('');
    load();
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-8">
      {error && <div className="text-red-600">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>FAQ Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCategory} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <Input label="Title" value={catTitle} onChange={(e) => setCatTitle(e.target.value)} required />
            <Input label="Slug" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} required />
            <Input label="Position" type="number" value={catPos} onChange={(e) => setCatPos(parseInt(e.target.value || '0'))} />
            <Button type="submit"><PlusCircle className="h-4 w-4 mr-1"/>Add Category</Button>
          </form>
          <div className="divide-y divide-maroon-100">
            {categories.map(c => (
              <div key={c.id} className="py-2 flex items-center justify-between">
                {editingCatId === c.id ? (
                  <form onSubmit={handleUpdateCategory} className="w-full grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                    <Input label="Title" value={editCatTitle} onChange={(e) => setEditCatTitle(e.target.value)} required />
                    <Input label="Slug" value={editCatSlug} onChange={(e) => setEditCatSlug(e.target.value)} required />
                    <Input label="Position" type="number" value={editCatPos} onChange={(e) => setEditCatPos(parseInt(e.target.value || '0'))} />
                    <div className="flex space-x-2">
                      <Button type="submit" size="sm">Save</Button>
                      <Button type="button" variant="outline" size="sm" onClick={cancelEditCategory}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-sm text-gray-500">/{c.slug} • pos {c.position}</div>
                    </div>
                    {confirmCatDeleteId === c.id ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-red-700">Delete category? Entries will be left uncategorized.</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            await handleDeleteCategory(c.id);
                            setConfirmCatDeleteId('');
                          }}
                        >
                          Confirm
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmCatDeleteId('')}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => beginEditCategory(c)}>
                          <Edit className="h-4 w-4"/>
                        </Button>
                        <Button type="button" variant="danger" size="sm" onClick={() => setConfirmCatDeleteId(c.id)}>
                          <Trash2 className="h-4 w-4"/>
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && <div className="text-sm text-maroon-600">No categories yet.</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateEntry} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-sm text-maroon-700">Category</label>
              <select
                className="mt-1 w-full border-2 border-maroon-200 rounded-xl px-3 py-2"
                value={eCategoryId}
                onChange={(e) => setECategoryId(e.target.value)}
              >
                <option value="">Uncategorized</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <Input label="Position" type="number" value={ePos} onChange={(e) => setEPos(parseInt(e.target.value || '0'))} />
            <Input label="Question" value={eQuestion} onChange={(e) => setEQuestion(e.target.value)} required />
            <div>
              <label className="text-sm text-maroon-700">Tags (comma-separated)</label>
              <input className="mt-1 w-full border-2 border-maroon-200 rounded-xl px-3 py-2" value={eTags} onChange={(e) => setETags(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-maroon-700">Answer (Markdown)</label>
              <textarea className="mt-1 w-full border-2 border-maroon-200 rounded-xl px-3 py-2 min-h-[120px]" value={eAnswer} onChange={(e) => setEAnswer(e.target.value)} required />
            </div>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={ePublished} onChange={(e) => setEPublished(e.target.checked)} />
              <span className="text-sm text-maroon-700">Published</span>
            </label>
            <Button type="submit"><PlusCircle className="h-4 w-4 mr-1"/>Add Entry</Button>
          </form>
          <div className="divide-y divide-maroon-100">
            {entries.map(en => (
              <div key={en.id} className="py-2">
                {editingEntryId === en.id ? (
                  <form onSubmit={handleUpdateEntry} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-maroon-700">Category</label>
                      <select
                        className="mt-1 w-full border-2 border-maroon-200 rounded-xl px-3 py-2"
                        value={edCategoryId}
                        onChange={(e) => setEdCategoryId(e.target.value)}
                      >
                        <option value="">Uncategorized</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </div>
                    <Input label="Position" type="number" value={edPos} onChange={(e) => setEdPos(parseInt(e.target.value || '0'))} />
                    <Input label="Question" value={edQuestion} onChange={(e) => setEdQuestion(e.target.value)} required />
                    <div>
                      <label className="text-sm text-maroon-700">Tags (comma-separated)</label>
                      <input className="mt-1 w-full border-2 border-maroon-200 rounded-xl px-3 py-2" value={edTags} onChange={(e) => setEdTags(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm text-maroon-700">Answer (Markdown)</label>
                      <textarea className="mt-1 w-full border-2 border-maroon-200 rounded-xl px-3 py-2 min-h-[120px]" value={edAnswer} onChange={(e) => setEdAnswer(e.target.value)} required />
                    </div>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" checked={edPublished} onChange={(e) => setEdPublished(e.target.checked)} />
                      <span className="text-sm text-maroon-700">Published</span>
                    </label>
                    <div className="flex space-x-2">
                      <Button type="submit" size="sm">Save</Button>
                      <Button type="button" variant="outline" size="sm" onClick={cancelEditEntry}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{en.question}</div>
                      <div className="text-sm text-gray-500">{en.tags?.join(', ') || 'no tags'} • pos {en.position} • {en.published ? 'published' : 'draft'}</div>
                    </div>
                    {confirmEntryDeleteId === en.id ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-red-700">Delete this entry?</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            await handleDeleteEntry(en.id);
                            setConfirmEntryDeleteId('');
                          }}
                        >
                          Confirm
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmEntryDeleteId('')}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => beginEditEntry(en)}>
                          <Edit className="h-4 w-4"/>
                        </Button>
                        <Button type="button" variant="danger" size="sm" onClick={() => setConfirmEntryDeleteId(en.id)}>
                          <Trash2 className="h-4 w-4"/>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {entries.length === 0 && <div className="text-sm text-maroon-600">No entries yet.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFAQManager;
