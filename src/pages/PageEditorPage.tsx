import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, AlertCircle, Check, Link as LinkIcon, Eye, Code, Image, Info, X, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { marked } from 'marked';
import TipTapEditor from '../components/cms/TipTapEditor';
import { RESERVED_SLUGS } from '../lib/constants'; 
import { PAGE_TYPES, getPageType } from '../lib/pageTypes';
import ImageUploadModal from '../components/cms/ImageUploadModal';
import { uploadCmsImage } from '../lib/upload/r2Single';

const PageEditorPage: React.FC = () => {
  // Get the id from the URL and ensure it's a string or undefined
  const params = useParams<{ id?: string }>();
  const id = params.id;
  const isNewPage = id === 'new';
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [imagePickerResolver, setImagePickerResolver] = useState<((url: string) => void) | null>(null);
  const [showSlugInfoModal, setShowSlugInfoModal] = useState(false);
  const [pageData, setPageData] = useState({
    title: '',
    slug: '',
    content: '',
    type: 'Information' as string,
    publishedAt: null as string | null,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pubPopoverOpen, setPubPopoverOpen] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [existingSlugs, setExistingSlugs] = useState<string[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    console.log('[PageEditor] pageData state updated', {
      title: pageData.title,
      slug: pageData.slug,
      contentLength: pageData.content?.length || 0,
      type: pageData.type,
    });
  }, [pageData]);

  useEffect(() => {
    console.log('[PageEditor] editingId state updated', editingId);
  }, [editingId]);

  useEffect(() => {
    console.log('[PageEditor] loading state', loading);
  }, [loading]);

  // Date helpers: convert ISO -> datetime-local input value and back
  const toLocalInput = (iso: string | null): string => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      const pad = (n: number) => String(n).padStart(2, '0')
      const yyyy = d.getFullYear()
      const mm = pad(d.getMonth() + 1)
      const dd = pad(d.getDate())
      const hh = pad(d.getHours())
      const mi = pad(d.getMinutes())
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
    } catch { return '' }
  }

  const fromLocalInput = (local: string): string | null => {
    if (!local) return null
    try {
      // Treat local as local time, convert to ISO
      const d = new Date(local)
      return d.toISOString()
    } catch { return null }
  }

  // Cleanup function for the component
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Load existing page data if editing
  useEffect(() => {
    // Only proceed if component is still mounted
    if (!isMounted.current) return;

    console.log('[PageEditor] effect run', {
      authLoading,
      hasUser: !!user,
      userIsAdmin: user?.is_admin,
      isNewPage,
      id,
    });

    if (authLoading) {
      console.log('[PageEditor] effect exit: auth loading');
      return;
    }

    if (!user) {
      console.log('[PageEditor] effect exit: no user');
      return;
    }

    // Skip if id is not available yet and it's not a new page
    if (!isNewPage && !id) {
      console.error('Page ID is missing');
      return;
    }

    // Define the loadPageData function inside the effect to avoid dependency issues
    const loadPageData = async (pageId: string) => {
      const safePageId = pageId || '';

      console.log('[PageEditor] loadPageData invoked', { pageId, safePageId, isNewPage });

      if (isMounted.current) {
        setLoading(true);
        if (!safePageId) {
          setEditingId(null);
        }
      }

      try {
        const { data: allPages, error: slugsError } = await supabase
          .from('pages')
          .select('slug');

        if (slugsError) throw slugsError;

        if (isMounted.current) {
          setExistingSlugs(allPages?.map(p => p.slug) || []);
        }

        if (!isNewPage && safePageId) {
          let record: any = null;
          let lastError: Error | null = null;

          const fetchById = async () => {
            const { data, error } = await supabase
              .from('pages')
              .select('*')
              .eq('id', safePageId)
              .single();
            console.log('[PageEditor] fetchById response', { data, error });
            if (error) {
              lastError = error;
              console.log('[PageEditor] fetchById error', error);
              return null;
            }
            return data;
          };

          const fetchBySlug = async () => {
            const { data, error } = await supabase
              .from('pages')
              .select('*')
              .eq('slug', safePageId)
              .single();
            console.log('[PageEditor] fetchBySlug response', { data, error });
            if (error) {
              lastError = error;
              console.log('[PageEditor] fetchBySlug error', error);
              return null;
            }
            return data;
          };

          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(safePageId)) {
            record = await fetchById();
            if (!record) record = await fetchBySlug();
          } else {
            record = await fetchBySlug();
            if (!record) record = await fetchById();
          }

          if (!record) {
            console.log('[PageEditor] no record found after fetch attempts', { safePageId, lastError });
            throw lastError || new Error('Page not found');
          }

          console.log('[PageEditor] pre-set state', { record, isMounted: isMounted.current });
          if (isMounted.current) {
            const row: any = record as any;
            console.log('[PageEditor] record resolved', {
              id: record.id,
              slug: record.slug,
              hasContent: typeof record.content === 'string',
              contentLength: record.content ? String(record.content).length : 0,
            });
            setPageData({
              title: record.title,
              slug: record.slug,
              content: record.content,
              type: getPageType(record.type),
              publishedAt: row?.created_at ?? null,
            });
            setEditingId(record.id as string);
            console.log('[PageEditor] record loaded', { id: record.id, slug: record.slug });
          }
        }
      } catch (err) {
        if (isMounted.current) {
          console.error('Error loading page data:', err);
          setError(err instanceof Error ? err.message : 'Failed to load page data');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
        console.log('[PageEditor] loadPageData complete');
      }
    };

    // Only call loadPageData if we have a valid id or it's a new page
    if (isNewPage) {
      console.log('[PageEditor] calling loadPageData for new page');
      loadPageData('');
    } else if (id) {
      console.log('[PageEditor] calling loadPageData for existing page', { id });
      loadPageData(id);
    }
  }, [authLoading, id, isNewPage, user]);

  // Handle slug validation and formatting
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Convert to lowercase, replace spaces with hyphens, remove special characters
    const formattedSlug = rawValue
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    setPageData({ ...pageData, slug: formattedSlug });
    
    // Validate slug
    if (!formattedSlug) {
      setSlugError('Slug is required');
    } else if (RESERVED_SLUGS.includes(formattedSlug)) {
      setSlugError(`This slug is reserved for application use. Please choose another slug.`);
    } else if (existingSlugs.includes(formattedSlug) && (isNewPage || formattedSlug !== pageData.slug)) {
      setSlugError('This slug is already in use');
    } else {
      setSlugError(null);
    }
  };

  // Handle editor change (TipTap provides HTML)
  const handleEditorChange = useCallback((html: string) => {
    setPageData(prev => ({ ...prev, content: html }));
  }, []);

  // Provide an onPickImage handler for TipTap to open the upload modal and resolve with a URL
  const onPickImage = useCallback((): Promise<string> => {
    return new Promise<string>((resolve) => {
      setImagePickerResolver(() => resolve);
      setShowImageUploadModal(true);
    });
  }, []);

  // onModalUpload is defined after handleImageUpload to avoid temporal dead zone

  // Handle saving the page
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    console.log('[PageEditor] save start', {
      isNewPage,
      id,
      editingId,
      payloadPreview: {
        title: pageData.title,
        slug: pageData.slug,
        type: pageData.type,
      },
    });

    try {
      // Validate required fields
      if (!pageData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!pageData.slug.trim()) {
        throw new Error('Slug is required');
      }
      if (slugError) {
        throw new Error('Please fix the slug error before saving');
      }

      // Ensure the page type is valid
      const validatedType = getPageType(pageData.type);

      // Prepare the payload - only include columns that exist in the database
      const payload = {
        title: pageData.title.trim(),
        slug: pageData.slug.trim(),
        content: pageData.content,
        type: validatedType, // This will be validated by the database check constraint
        updated_at: new Date().toISOString(),
      };

      let error = null;

      if (isNewPage) {
        // For new pages, just insert - don't try to check if page exists first
        const { error: insertError } = await supabase
          .from('pages')
          .insert([payload]);

        error = insertError;
        console.log('[PageEditor] insert result', { error: insertError });

        // Only update state if component is still mounted
        if (isMounted.current) {
          if (error) {
            // If there's an error with the type field, try again without it
            if (error.message.includes('column "type"') || error.message.includes('invalid input value for enum')) {
              const { title, slug, content } = payload;
              const { error: retryError } = await supabase
                .from('pages')
                .insert([{ title, slug, content, updated_at: new Date().toISOString() }]);

              if (retryError) throw retryError;

              setSuccess('Page created successfully (without type)');
            } else {
              throw error;
            }
          } else {
            setSuccess('Page created successfully');
          }

          // Navigate to the page list after a short delay
          setTimeout(() => {
            if (isMounted.current) {
              navigate('/admin');
            }
          }, 1500);
        }
      } else {
        // Update existing page
        const targetId = editingId || id;
        if (!targetId) {
          throw new Error('Page ID is required for updating');
        }

        const { error: updateError } = await supabase
          .from('pages')
          .update(payload)
          .eq('id', targetId);

        error = updateError;
        console.log('[PageEditor] update result', { targetId, error: updateError });

        // Only update state if component is still mounted
        if (isMounted.current) {
          if (error) {
            // If there's an error with the type field, try again without it
            if (error.message.includes('column "type"') || error.message.includes('invalid input value for enum')) {
              const { title, slug, content } = payload;
              const { error: retryError } = await supabase
                .from('pages')
                .update({
                  title,
                  slug,
                  content,
                  updated_at: new Date().toISOString()
                })
                .eq('id', id);

              if (retryError) throw retryError;

              setSuccess('Page updated successfully (without type)');
            } else {
              throw error;
            }
          } else {
            setSuccess('Page updated successfully');
          }
        }
      }
    } catch (err) {
      // Only update state if component is still mounted
      if (isMounted.current) {
        console.error('Error saving page:', err);
        let errorMessage = 'Failed to save page';

        if (err instanceof Error) {
          // Handle specific error cases
          if (err.message.includes('duplicate key value violates unique constraint')) {
            errorMessage = 'A page with this slug already exists. Please choose a different slug.';
          } else if (err.message.includes('invalid input value for enum')) {
            errorMessage = `Invalid page type selected. Valid types are: ${PAGE_TYPES.join(', ')}`;
          } else if (err.message.includes('new row violates row-level security policy')) {
            errorMessage = 'You do not have permission to perform this action.';
          } else if (err.message.includes('page_type')) {
            errorMessage = `Invalid page type. Please select one of: ${PAGE_TYPES.join(', ')}`;
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);
      }
    } finally {
      console.log('[PageEditor] save finally (setSaving false)', {
        isMounted: isMounted.current,
      });
      // Only update state if component is still mounted
      if (isMounted.current) {
        setSaving(false);
      }
    }
  };

  // Upload image via Cloudflare R2 presigned flow (Edge Function r2-presign)
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    try {
      const url = await uploadCmsImage(supabase, file);
      return url;
    } catch (err) {
      console.error('Error uploading image:', err);
      throw new Error('Failed to upload image');
    }
  }, []);

  // Define onModalUpload AFTER handleImageUpload to avoid temporal dead zone
  const onModalUpload = useCallback(async (file: File): Promise<string> => {
    const url = await handleImageUpload(file);
    if (imagePickerResolver) {
      try {
        imagePickerResolver(url);
      } finally {
        setImagePickerResolver(null);
        setShowImageUploadModal(false);
      }
    }
    return url;
  }, [handleImageUpload, imagePickerResolver]);

  // Legacy: markdown preview support for older pages
  const renderPreview = useCallback((content: string) => {
    const looksLikeHtml = /<([a-z][\w\-]*)(?:(?:\s+[^>\/]*)?)>/i.test(content)
    if (looksLikeHtml) return content
    try {
      return String(marked.parse(content))
    } catch (e) {
      return '<p>Error rendering preview</p>'
    }
  }, [])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  // Check admin access at component level
  if (!authLoading && !loading && user && user.is_admin === false) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-maroon-800 mb-2">Access Denied</h2>
          <p className="text-maroon-600 mb-4">You do not have administrative privileges to edit pages.</p>
          <Button onClick={() => navigate('/admin')}>Go to Admin Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl xl:max-w-screen-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/admin')}
              className="mr-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Admin
            </Button>
            <h1 className="text-3xl font-bold text-maroon-800 font-display">
              {isNewPage ? 'Create New Page' : 'Edit Page'}
            </h1>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowImageUploadModal(true)}
            >
              <Image className="mr-2 h-4 w-4" />
              Upload Image
            </Button>
            <Button
              variant="outline"
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? (
                <>
                  <Code className="mr-2 h-4 w-4" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
            <Button
              onClick={handleSave}
              isLoading={saving}
              disabled={saving || !!slugError}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Page
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl flex items-start">
            <Check className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* Page Metadata */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Title */}
                <div>
                  <Input
                    label="Page Title"
                    value={pageData.title}
                    onChange={(e) => setPageData({ ...pageData, title: e.target.value })}
                    required
                  />
                </div>
                {/* Slug */}
                <div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-maroon-700 font-display">
                      Page URL Slug
                      <button 
                        type="button"
                        onClick={() => setShowSlugInfoModal(true)}
                        className="ml-2 inline-flex items-center text-maroon-500 hover:text-maroon-700 focus:outline-none"
                        aria-label="Show slug information"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LinkIcon className="h-5 w-5 text-maroon-400" />
                      </div>
                      <input
                        type="text"
                        value={pageData.slug}
                        onChange={handleSlugChange}
                        className={`pl-10 w-full rounded-xl border-2 ${
                          slugError ? 'border-red-300 focus:ring-red-500' : 'border-maroon-200 focus:ring-maroon-500'
                        } bg-white px-4 py-2 text-base placeholder:text-maroon-300 focus:outline-none focus:ring-2 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 font-sans transition-all`}
                        placeholder="page-url-slug"
                        required
                      />
                    </div>
                    {slugError && <p className="text-sm text-red-500">{slugError}</p>}
                    <p className="text-xs text-maroon-500">
                      This will be the URL of your page: yourdomain.com/{pageData.slug || 'page-slug'}
                    </p>
                  </div>
                </div>
                {/* Page Type + Publication Date */}
                <div className="relative">
                  <label className="block text-sm font-medium text-maroon-700 font-display mb-2">
                    Page Type
                  </label>
                  <select
                    value={pageData.type}
                    onChange={(e) => setPageData({ ...pageData, type: e.target.value })}
                    className="w-full rounded-xl border-2 border-maroon-200 p-3 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                  >
                    {PAGE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-maroon-500">
                      Categorizes the page for organization and potential filtering
                    </p>
                    <div className="relative">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-maroon-700 hover:text-maroon-900 text-sm"
                        onClick={() => setPubPopoverOpen(v => !v)}
                        aria-haspopup="dialog"
                        aria-expanded={pubPopoverOpen}
                        title="Edit publication date"
                      >
                        <Calendar className="h-4 w-4" />
                        <span className="hidden sm:inline">Publish date</span>
                      </button>
                      {pubPopoverOpen && (
                        <div className="absolute right-0 mt-2 w-72 rounded-lg border border-maroon-200 bg-white shadow-lg z-[100] p-3" role="dialog" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPubPopoverOpen(false) }} tabIndex={-1}>
                          <label className="block text-xs text-maroon-600 mb-1">Publication date</label>
                          <input
                            type="datetime-local"
                            value={toLocalInput(pageData.publishedAt)}
                            onChange={(e) => setPageData(prev => ({ ...prev, publishedAt: fromLocalInput(e.target.value) }))}
                            className="w-full border border-maroon-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                          />
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button type="button" className="px-2 py-1 text-sm rounded-md border border-maroon-200 hover:bg-maroon-50" onClick={() => setPubPopoverOpen(false)}>Close</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Page Content */}
          <Card>
            <CardContent className="pt-4">
              {previewMode ? (
                <div className="prose prose-maroon max-w-none p-6 bg-white border border-maroon-100 rounded-xl">
                  <div dangerouslySetInnerHTML={{ __html: renderPreview(pageData.content) }} />
                </div>
              ) : (
                <TipTapEditor
                  value={pageData.content}
                  onChange={handleEditorChange}
                  placeholder="Write your page content…"
                  onPickImage={onPickImage}
                />
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Image Upload Modal */}
        <ImageUploadModal
          isOpen={showImageUploadModal}
          onClose={() => setShowImageUploadModal(false)}
          onUpload={onModalUpload}
        />
        
        {/* Slug Info Modal */}
        {showSlugInfoModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-maroon-800 flex items-center">
                  <Info className="h-5 w-5 mr-2 text-maroon-600" />
                  Page URL Information
                </h3>
                <button
                  onClick={() => setShowSlugInfoModal(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="font-medium text-blue-800 mb-2">URL Structure</p>
                  <p className="text-blue-700 mb-2">
                    Pages are accessible directly at the root URL:
                  </p>
                  <code className="block bg-blue-100 p-2 rounded text-blue-800 font-mono text-sm">
                    yourdomain.com/page-slug
                  </code>
                </div>
                
                <div>
                  <p className="font-medium text-maroon-800 mb-2">Slug Guidelines:</p>
                  <ul className="list-disc pl-5 space-y-1 text-maroon-600">
                    <li>Use lowercase letters, numbers, and hyphens only</li>
                    <li>No spaces or special characters</li>
                    <li>Keep it short and descriptive</li>
                    <li>Use hyphens to separate words (e.g., "about-us")</li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-medium text-maroon-800 mb-2">Reserved Slugs:</p>
                  <p className="text-maroon-600 mb-2">
                    The following slugs cannot be used as they are reserved for application routes:
                  </p>
                  <div className="max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                    <div className="flex flex-wrap gap-1">
                      {RESERVED_SLUGS.map(slug => (
                        <span key={slug} className="px-2 py-1 bg-maroon-100 text-maroon-800 rounded text-xs">
                          {slug}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setShowSlugInfoModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PageEditorPage;