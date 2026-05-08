/**
 * Defines the available page types for the CMS
 * 
 * To add a new page type:
 * 1. Add it to this array
 * 2. Update the CHECK constraint in the database (via a migration)
 */
export const PAGE_TYPES = [
  'Support',
  'Legal',
  'News',
  'Information',
  'Documentation',
  'Landing Page',
  'Features'
] as const;

export type PageType = typeof PAGE_TYPES[number];

// Helper function to check if a string is a valid page type
export function isValidPageType(type: string): type is PageType {
  return PAGE_TYPES.includes(type as PageType);
}

// Get a page type with a fallback to 'Information' if invalid
export function getPageType(type: string | null | undefined): PageType {
  if (!type || !isValidPageType(type)) {
    return 'Information';
  }
  return type;
}