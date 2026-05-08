import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowRight } from 'lucide-react';

export default function Footer() {
  const [supportPages, setSupportPages] = useState<{ slug: string; title: string }[]>([]);
  const [legalPages, setLegalPages] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    const loadPages = async () => {
      try {
        // Load Support pages
        const { data: supportData } = await supabase
          .from('pages')
          .select('slug, title, type')
          .eq('type', 'Support')
          .order('title');
        
        setSupportPages(supportData || []);
        
        // Load Legal pages
        const { data: legalData } = await supabase
          .from('pages')
          .select('slug, title, type')
          .eq('type', 'Legal')
          .order('title');
        
        setLegalPages(legalData || []);
      } catch (error) {
        console.error('Error loading pages:', error);
      }
    };

    loadPages();
  }, []);

  return (
<footer className="bg-gray-900 text-white py-12 relative">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex flex-col md:flex-row gap-y-8 md:gap-x-12">

      {/* Company Info */}
      <div className="md:basis-2/5">
        <h3 className="text-xl font-bold mb-4">SplitSpace</h3>
        <p className="text-gray-300 mb-4">
        Connect with unique venues and spaces for your next short-term retail pop-up, event, or creative project.
        </p>
        <a href="/news-info" className="text-gray-300 mb-4 inline-flex items-center gap-2 hover:text-white transition-colors">
          <ArrowRight className="h-4 w-4" />
          <span>News & Information</span>
        </a>
      </div>

      {/* Quick Links */}
      <div className="md:basis-1/5">
        <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
        <ul className="space-y-2">
          <li>
            <a href="/properties" className="text-gray-300 hover:text-white transition-colors">
              Browse Venues
            </a>
          </li>
          <li>
            <a href="/list-property" className="text-gray-300 hover:text-white transition-colors">
              List Your Space
            </a>
          </li>
          <li>
            <a href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
              Dashboard
            </a>
          </li>
          <li>
            <a href="/favorites" className="text-gray-300 hover:text-white transition-colors">
              Favorites
            </a>
          </li>
        </ul>
      </div>

      {/* Support */}
      <div className="md:basis-1/5">
        <h4 className="text-lg font-semibold mb-4">Support</h4>
        <ul className="space-y-2">
          {supportPages.map(page => (
            <li key={page.slug}>
              <Link to={`/${page.slug}`} className="text-gray-300 hover:text-white transition-colors">
                {page.title}
              </Link>
            </li>
          ))}
          {/* Static FAQ link at the bottom of Support section */}
          <li>
            <Link to="/faq" className="text-gray-300 hover:text-white transition-colors">
              Frequently Asked Questions
            </Link>
          </li>
        </ul>
      </div>

      {/* Legal */}
      <div className="md:basis-1/5">
        <h4 className="text-lg font-semibold mb-4">Legal</h4>
        <ul className="space-y-2">
          {legalPages.map(page => (
            <li key={page.slug}>
              <Link to={`/${page.slug}`} className="text-gray-300 hover:text-white transition-colors">
                {page.title}
              </Link>
            </li>
          ))}
          {legalPages.length === 0 && (
            <li className="text-gray-500 text-sm italic">No legal pages found</li>
          )}
        </ul>
      </div>
    </div>

    {/* Bottom Bar */}
    <div className="border-t border-gray-800 mt-8 pt-8 text-center">
      <p className="text-gray-400">
        © {new Date().getFullYear()} SplitSpace. All rights reserved.
      </p>
    </div>
  </div>
</footer>
  );
}