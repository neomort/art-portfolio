import React from 'react';
import ButtonGallery from '../components/debug/ButtonGallery';
import { NavLink } from 'react-router-dom';

/**
 * ButtonGalleryPage - A debug page for viewing all button styles
 * This helps with UI standardization and visual testing
 */
const ButtonGalleryPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <NavLink 
          to="/dashboard" 
          className="text-maroon-600 hover:text-maroon-700 flex items-center"
        >
          <svg 
            className="w-5 h-5 mr-1" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </NavLink>
      </div>
      
      <ButtonGallery />
    </div>
  );
};

export default ButtonGalleryPage;
