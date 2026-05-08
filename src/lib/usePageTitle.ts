import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = title;
    }
  }, [title]);
}

export function usePageHeaderTitle(label: string) {
  usePageTitle(`SplitSpace - ${label}`);
}
