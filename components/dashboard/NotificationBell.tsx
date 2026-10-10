'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { markNotificationsRead } from '@/app/(dashboard)/actions';

interface BellNotice {
  id: string;
  title: string;
  body: string;
  href: string;
}

const PANEL_WIDTH = 320;

export function NotificationBell({
  unread,
  items,
}: {
  unread: number;
  items: BellNotice[];
}) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => setMounted(true), []);

  const placePanel = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.right - PANEL_WIDTH),
      window.innerWidth - PANEL_WIDTH - 8
    );
    setPosition({ top: rect.bottom + 8, left });
  };

  useEffect(() => {
    if (!open) return;
    placePanel();
    const onResize = () => placePanel();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    if (next) placePanel();
    setOpen(next);
    if (next && unread > 0) {
      await markNotificationsRead();
      router.refresh();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          void toggle();
        }}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ash bg-white text-portrait-ink"
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff4940] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: PANEL_WIDTH,
              zIndex: 80,
            }}
            className="rounded-[24px] border border-ash bg-white p-3 shadow-lg"
          >
            <p className="px-2 font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
              Notifications
            </p>
            {items.length === 0 ? (
              <p className="px-2 py-4 font-switzer text-sm text-slate-helper">
                You are all caught up.
              </p>
            ) : (
              <ul className="mt-2 max-h-[min(22rem,calc(100vh-8rem))] space-y-1 overflow-y-auto overscroll-contain pr-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-2xl px-2 py-2 hover:bg-sky-wash"
                    >
                      <p className="font-switzer text-sm font-semibold leading-5 text-portrait-ink">
                        {item.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 font-switzer text-xs leading-5 text-slate-helper">
                        {item.body}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
