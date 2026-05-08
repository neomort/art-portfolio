import React from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

/**
 * ButtonGallery - A component to display all button variants, sizes, and states
 * Use this for visual testing and standardization of button styles
 */
const ButtonGallery: React.FC = () => {
  return (
    <div className="p-8 space-y-10 bg-white rounded-lg shadow">
      <div>
        <h1 className="text-3xl font-bold mb-2 font-display">Button Gallery</h1>
        <p className="text-gray-600 mb-6">Visual reference for all button styles in SplitSpace</p>
      </div>

      {/* Button Variants */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Button Variants</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-4">
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="primary" className="w-full">Primary</Button>
            <span className="text-sm text-gray-500">variant="primary"</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="secondary" className="w-full">Secondary</Button>
            <span className="text-sm text-gray-500">variant="secondary"</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="outline" className="w-full">Outline</Button>
            <span className="text-sm text-gray-500">variant="outline"</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="ghost" className="w-full">Ghost</Button>
            <span className="text-sm text-gray-500">variant="ghost"</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="link" className="w-full">Link</Button>
            <span className="text-sm text-gray-500">variant="link"</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="danger" className="w-full">Danger</Button>
            <span className="text-sm text-gray-500">variant="danger"</span>
          </div>
        </div>
      </section>
      
      <Separator />
      
      {/* Button Sizes */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Button Sizes</h2>
        <div className="flex flex-col sm:flex-row gap-6 mb-4 items-end">
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="primary" size="sm">Small</Button>
            <span className="text-sm text-gray-500">size="sm"</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="primary" size="md">Medium</Button>
            <span className="text-sm text-gray-500">size="md" (default)</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="primary" size="lg">Large</Button>
            <span className="text-sm text-gray-500">size="lg"</span>
          </div>
        </div>
      </section>
      
      <Separator />
      
      {/* Button States */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Button States</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="primary" className="w-full">Normal</Button>
            <span className="text-sm text-gray-500">Normal</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="primary" className="w-full" disabled>Disabled</Button>
            <span className="text-sm text-gray-500">disabled</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="primary" className="w-full" isLoading>Loading</Button>
            <span className="text-sm text-gray-500">isLoading</span>
          </div>

          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button
              variant="primary"
              className="w-full"
              icon={
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              }
            >
              With Icon
            </Button>
            <span className="text-sm text-gray-500">With icon prop</span>
          </div>
        </div>
      </section>
      
      <Separator />
      
      {/* All Variants with Full Width */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Full Width Buttons</h2>
        <div className="flex flex-col gap-3 mb-4">
          <Button variant="primary" className="w-full">Primary Full Width</Button>
          <Button variant="secondary" className="w-full">Secondary Full Width</Button>
          <Button variant="outline" className="w-full">Outline Full Width</Button>
          <Button variant="ghost" className="w-full">Ghost Full Width</Button>
          <Button variant="link" className="w-full">Link Full Width</Button>
          <Button variant="danger" className="w-full">Danger Full Width</Button>
        </div>
      </section>
      
      <Separator />
      
      {/* Comparison with Native Buttons */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Component vs. Native Buttons</h2>
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <Button variant="primary" className="w-full">Button Component</Button>
            <span className="text-sm text-gray-500">&lt;Button&gt; component</span>
          </div>
          
          <div className="flex flex-col gap-2 items-center justify-center p-4 border border-gray-200 rounded-lg">
            <button className="w-full rounded-3xl border-2 border-maroon-200 bg-transparent hover:bg-[#fbe9e9] text-maroon-700 h-8 px-4 py-1.5 text-sm font-medium">
              Native Button
            </button>
            <span className="text-sm text-gray-500">Native &lt;button&gt; with custom classes</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ButtonGallery;
