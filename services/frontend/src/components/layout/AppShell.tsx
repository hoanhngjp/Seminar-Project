import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomPlayerBar from './BottomPlayerBar';
import MobileNav from './MobileNav';

interface AppShellProps {
  children: ReactNode;
  /** Optional content rendered in a sticky top header (e.g. search input) */
  headerContent?: ReactNode;
}

export default function AppShell({ children, headerContent }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-near-black text-text-base font-sans selection:bg-spotify-green selection:text-black">
      {/* ── Fixed Sidebar (hidden on mobile) ── */}
      <Sidebar />

      {/* ── Main scrollable content ──
          Mobile: pb-[128px] to clear MobileNav (56px) + BottomPlayerBar (72px)
          Desktop: pb-[72px] — Sidebar takes left space, no MobileNav */}
      <main className="flex-1 ml-0 lg:ml-[240px] pb-[128px] lg:pb-[72px] h-full overflow-y-auto bg-near-black relative">
        {/* Optional sticky header */}
        {headerContent && (
          <header className="sticky top-0 z-40 bg-[rgba(13,21,13,0.85)] backdrop-blur-md flex items-center h-16 px-6 border-b border-border-muted/20">
            {headerContent}
          </header>
        )}
        {children}
      </main>

      {/* ── Fixed Bottom Player Bar (mobile: sits above MobileNav) ── */}
      <BottomPlayerBar />

      {/* ── Mobile Bottom Nav (hidden on desktop) ── */}
      <MobileNav />
    </div>
  );
}
