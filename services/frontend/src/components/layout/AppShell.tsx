import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomPlayerBar from './BottomPlayerBar';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-near-black text-text-base font-sans selection:bg-spotify-green selection:text-black">
      {/* ── Fixed Sidebar (hidden on mobile) ── */}
      <Sidebar />

      {/* ── Main scrollable content ── */}
      <main className="flex-1 ml-0 lg:ml-[240px] pb-[72px] h-full overflow-y-auto bg-near-black relative">
        {children}
      </main>

      {/* ── Fixed Bottom Player Bar ── */}
      <BottomPlayerBar />
    </div>
  );
}
