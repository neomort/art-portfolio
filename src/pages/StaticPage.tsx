import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { marked } from 'marked';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';

const StaticPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [renderedContent, setRenderedContent] = useState<string>('');
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  // Render TipTap HTML directly; fallback to markdown for legacy content
  useEffect(() => {
    const render = async (content: string) => {
      // Heuristic: if appears to be HTML, use as-is; otherwise render markdown
      const looksLikeHtml = /<([a-z][\w\-]*)(?:(?:\s+[^>\/]*)?)>/i.test(content);
      if (looksLikeHtml) return content;
      try {
        return await marked.parse(content);
      } catch (error) {
        console.error('Error rendering content:', error);
        return '<p>Error rendering content</p>';
      }
    };

    if (pageData?.content) {
      render(pageData.content).then(setRenderedContent);
    }
  }, [pageData?.content]);

  // Normalize anchors: internal/hash links open in same tab; external in new tab
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const anchors = Array.from(root.querySelectorAll('a')) as HTMLAnchorElement[];
    anchors.forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (!href) return;
      if (href.startsWith('#')) {
        a.target = '_self';
        a.rel = '';
        return;
      }
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin === window.location.origin) {
          a.target = '_self';
          a.rel = '';
        } else {
          a.target = '_blank';
          a.rel = 'noopener';
        }
      } catch {
        // If URL parsing fails, default to same tab
        a.target = '_self';
        a.rel = '';
      }
    });
  }, [renderedContent]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const brevoBlocks = Array.from(root.querySelectorAll<HTMLElement>('[data-brevo-signup]'));
    if (!brevoBlocks.length) return;

    const brevoObservers: MutationObserver[] = [];

    const loadedScripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[data-brevo-loaded]'))
      .reduce<Record<string, boolean>>((acc, script) => {
        const key = script.getAttribute('data-brevo-loaded');
        if (key) acc[key] = true;
        return acc;
      }, {});

    const loadExternalScript = (src: string, attrs: { async: boolean; defer: boolean }) => {
      if (loadedScripts[src]) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        if (attrs.async) script.async = true;
        if (attrs.defer) script.defer = true;
        script.dataset.brevoLoaded = src;
        script.onload = () => {
          loadedScripts[src] = true;
          resolve();
        };
        script.onerror = () => {
          console.error('Failed to load Brevo form script', src);
          resolve();
        };
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      const globalAny = window as typeof window & { __brevoInlineRan?: boolean };
      for (const block of brevoBlocks) {
        if (block.dataset.brevoInitialized === 'true') continue;
        block.dataset.brevoInitialized = 'true';

        const encodedHtml = block.getAttribute('data-brevo-form-html');
        if (encodedHtml) {
          try {
            const decoded = decodeURIComponent(encodedHtml);
            const slot = block.querySelector('[data-brevo-form-slot]');
            if (slot) {
              slot.innerHTML = decoded;
            } else {
              block.insertAdjacentHTML('afterbegin', decoded);
            }
            const placeholder = block.querySelector('.brevo-signup-placeholder');
            if (placeholder) {
              placeholder.remove();
            }
          } catch (htmlError) {
            console.error('Failed to decode Brevo form HTML', htmlError);
          }
        }

        const statusBanner = (() => {
          const existing = block.querySelector<HTMLElement>('[data-brevo-status]');
          if (existing) return existing;
          const status = document.createElement('div');
          status.dataset.brevoStatus = 'true';
          status.className = 'brevo-signup-status hidden';
          block.insertBefore(status, block.firstChild);
          return status;
        })();

        const messagePanels = Array.from(block.querySelectorAll<HTMLElement>('.sib-form-message-panel'));

        const updateStatusBanner = () => {
          const visiblePanel = messagePanels.find((panel) => panel.classList.contains('brevo-message-visible'));
          if (!visiblePanel) {
            statusBanner.classList.add('hidden');
            statusBanner.classList.remove('brevo-signup-status--success', 'brevo-signup-status--error');
            statusBanner.textContent = '';
            return;
          }

          const messageType = visiblePanel.dataset.brevoMessage || 'info';
          const text = visiblePanel.textContent?.replace(/\s+/g, ' ').trim() || (messageType === 'success' ? 'You are subscribed!' : 'We could not process your subscription.');

          statusBanner.textContent = text;
          statusBanner.classList.remove('hidden');
          statusBanner.classList.toggle('brevo-signup-status--success', messageType === 'success');
          statusBanner.classList.toggle('brevo-signup-status--error', messageType !== 'success');
        };

        messagePanels.forEach((panel) => {
          if (panel.dataset.brevoVisibilityInitialized === 'true') {
            return;
          }

          const updateVisibility = () => {
            const computedDisplay = window.getComputedStyle(panel).display;
            const ariaHidden = panel.getAttribute('aria-hidden');
            const hiddenAttr = panel.getAttribute('hidden');
            const hasActiveClass = panel.classList.contains('sib-form-message-panel--active') || panel.classList.contains('sib-form-message-panel__text--center--visible');
            const shouldShow = (computedDisplay !== 'none' || hasActiveClass) && ariaHidden !== 'true' && hiddenAttr !== 'true';

            if (shouldShow) {
              panel.classList.add('brevo-message-visible');
            } else {
              panel.classList.remove('brevo-message-visible');
            }

            updateStatusBanner();
          };

          updateVisibility();
          const observer = new MutationObserver(updateVisibility);
          observer.observe(panel, {
            attributes: true,
            attributeFilter: ['style', 'class', 'data-state', 'data-status', 'hidden', 'aria-hidden'],
          });
          const parent = panel.parentElement;
          if (parent) {
            const parentObserver = new MutationObserver(updateVisibility);
            parentObserver.observe(parent, {
              attributes: true,
              attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'],
            });
            brevoObservers.push(parentObserver);
          }
          brevoObservers.push(observer);
          panel.dataset.brevoVisibilityInitialized = 'true';
        });

        updateStatusBanner();

        const scripts = Array.from(block.querySelectorAll<HTMLScriptElement>('script'));
        scripts.forEach((script) => script.remove());

        for (const script of scripts) {
          if (script.src) {
            await loadExternalScript(script.src, { async: script.async, defer: script.defer });
          } else {
            const code = script.textContent;
            if (!code?.trim()) continue;
            if (globalAny.__brevoInlineRan) continue;
            try {
              // eslint-disable-next-line @typescript-eslint/no-implied-eval
              const run = new Function(code);
              run();
              globalAny.__brevoInlineRan = true;
            } catch (err) {
              console.error('Failed to execute Brevo inline script', err);
            }
          }
        }
      }
    };

    void init();

    return () => {
      brevoObservers.forEach((observer) => observer.disconnect());
    };
  }, [renderedContent]);

  useEffect(() => {
    const loadPage = async () => {
      if (!slug) return;

      try {
        const { data, error } = await supabase
          .from('pages')
          .select('title, content, type')
          .eq('slug', slug)
          .maybeSingle();

        if (error) throw error;
        setPageData(data);
      } catch (err) {
        console.error('Error loading page:', err);
        setError(err instanceof Error ? err.message : 'Failed to load page');
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[60rem]">
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-maroon-300 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-maroon-800 mb-4 font-display">Page Not Found</h1>
            <p className="text-maroon-600 mb-8">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[60rem]">
        <h1 className="text-4xl font-bold text-maroon-800 mb-8 font-display text-center">
          {pageData.title}
        </h1>
        
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div ref={contentRef} className="prose prose-maroon max-w-none">
            {renderedContent ? (
              <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaticPage;