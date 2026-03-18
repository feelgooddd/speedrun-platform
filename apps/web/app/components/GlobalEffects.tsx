// components/GlobalEffects.tsx

//Currently this file is just a global Effect to disable scroll on number inputs.
'use client';

import { useEffect } from 'react';

export function GlobalEffects() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' &&
          (e.target as HTMLInputElement).type === 'number') {
        (e.target as HTMLInputElement).blur();
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: true });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  return null;
}