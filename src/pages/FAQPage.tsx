import React, { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import FAQModule from '../components/faq/FAQModule';

const FAQPage: React.FC = () => {
  const [q, setQ] = useState('');
  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-maroon-800 mb-8 font-display text-center">
          Frequently Asked Questions
        </h1>
        {/* Centered search below header, outside the white container */}
        <div className="mb-6 flex justify-center">
          <div className="relative max-w-xl w-full">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              className="pl-9 pr-3 py-2 w-full border-2 border-maroon-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
              placeholder="Search questions and answers"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <FAQModule query={q} onQueryChange={setQ} hideSearch />
        </div>
      </div>
    </div>
  );
};

export default FAQPage;
