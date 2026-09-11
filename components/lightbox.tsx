'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';

export type LightboxImage = { src: string; alt?: string; caption?: string };
type OpenLightbox = (input: LightboxImage[] | LightboxImage | string, startIndex?: number) => void;

const LightboxContext = createContext<OpenLightbox>(() => {});
export const useLightbox = () => useContext(LightboxContext);

export function HeroExpandButton({ onExpand, label = 'View larger photo' }: { onExpand: () => void; label?: string }) {
  return <button type="button" className="icon-button hero-expand-button" onClick={onExpand} aria-label={label}><Maximize2/></button>;
}

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const touchStart = useRef(0);

  const openLightbox = useCallback<OpenLightbox>((input, startIndex = 0) => {
    const list = typeof input === 'string' ? [{ src: input }] : Array.isArray(input) ? input : [input];
    const usable = list.filter((item) => item.src);
    if (!usable.length) return;
    setImages(usable);
    setIndex(Math.min(Math.max(startIndex, 0), usable.length - 1));
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const next = useCallback(() => setIndex((value) => (value + 1) % images.length), [images.length]);
  const prev = useCallback(() => setIndex((value) => (value - 1 + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, close, next, prev]);

  const current = images[index];

  return <LightboxContext.Provider value={openLightbox}>
    {children}
    {open && current && <div className="lightbox-overlay" role="dialog" aria-modal="true" aria-label={current.alt || 'Photo viewer'} onClick={close}
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => { const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 50 && images.length > 1) { if (delta > 0) prev(); else next(); } }}>
      <button type="button" className="lightbox-close" onClick={close} aria-label="Close photo viewer"><X/></button>
      {images.length > 1 && <button type="button" className="lightbox-nav lightbox-prev" onClick={(event) => { event.stopPropagation(); prev(); }} aria-label="Previous photo"><ChevronLeft/></button>}
      <figure onClick={(event) => event.stopPropagation()}>
        <img src={current.src} alt={current.alt || ''}/>
        {(current.caption || images.length > 1) && <figcaption>{current.caption}{images.length > 1 && <span>{index + 1} / {images.length}</span>}</figcaption>}
      </figure>
      {images.length > 1 && <button type="button" className="lightbox-nav lightbox-next" onClick={(event) => { event.stopPropagation(); next(); }} aria-label="Next photo"><ChevronRight/></button>}
    </div>}
  </LightboxContext.Provider>;
}
