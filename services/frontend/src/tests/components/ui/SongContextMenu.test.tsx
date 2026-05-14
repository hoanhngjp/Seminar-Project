import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { createRef } from 'react';
import SongContextMenu from '../../../components/ui/SongContextMenu';

function renderMenu(props: Partial<Parameters<typeof SongContextMenu>[0]> = {}) {
  const anchorRef = createRef<HTMLButtonElement>();
  const onClose = vi.fn();
  const { container } = render(
    <div>
      <button ref={anchorRef}>Anchor</button>
      <SongContextMenu
        songId="song-001"
        isOpen={true}
        onClose={onClose}
        anchorRef={anchorRef as React.RefObject<HTMLElement>}
        {...props}
      />
    </div>
  );
  return { container, onClose, anchorRef };
}

describe('SongContextMenu', () => {
  it('renders nothing when isOpen is false', () => {
    const anchorRef = createRef<HTMLButtonElement>();
    render(
      <div>
        <button ref={anchorRef}>Anchor</button>
        <SongContextMenu
          songId="song-001"
          isOpen={false}
          onClose={vi.fn()}
          anchorRef={anchorRef as React.RefObject<HTMLElement>}
        />
      </div>
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders menu when isOpen is true', () => {
    renderMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders all 5 menu items', () => {
    renderMenu();
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(5);
  });

  it('renders "Phát ngay" item', () => {
    renderMenu();
    expect(screen.getByRole('menuitem', { name: 'Phát ngay' })).toBeInTheDocument();
  });

  it('renders "Thêm vào Queue" item', () => {
    renderMenu();
    expect(screen.getByRole('menuitem', { name: 'Thêm vào Queue' })).toBeInTheDocument();
  });

  it('renders "Thêm vào Party" item', () => {
    renderMenu();
    expect(screen.getByRole('menuitem', { name: 'Thêm vào Party' })).toBeInTheDocument();
  });

  it('renders "Đến trang nghệ sĩ" item', () => {
    renderMenu();
    expect(screen.getByRole('menuitem', { name: 'Đến trang nghệ sĩ' })).toBeInTheDocument();
  });

  it('renders "Chia sẻ" item', () => {
    renderMenu();
    expect(screen.getByRole('menuitem', { name: 'Chia sẻ' })).toBeInTheDocument();
  });

  it('calls onClose when "Phát ngay" clicked', () => {
    const { onClose } = renderMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Phát ngay' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onAddToQueue and onClose when "Thêm vào Queue" clicked', () => {
    const onAddToQueue = vi.fn();
    const { onClose } = renderMenu({ onAddToQueue });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Thêm vào Queue' }));
    expect(onAddToQueue).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onAddToParty and onClose when "Thêm vào Party" clicked', () => {
    const onAddToParty = vi.fn();
    const { onClose } = renderMenu({ onAddToParty });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Thêm vào Party' }));
    expect(onAddToParty).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onGoToArtist and onClose when "Đến trang nghệ sĩ" clicked', () => {
    const onGoToArtist = vi.fn();
    const { onClose } = renderMenu({ onGoToArtist });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Đến trang nghệ sĩ' }));
    expect(onGoToArtist).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the menu', () => {
    const { onClose } = renderMenu();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the menu', () => {
    const { onClose } = renderMenu();
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('menu has z-[100] and bg-[#282828] classes', () => {
    renderMenu();
    const menu = screen.getByRole('menu');
    expect(menu.className).toContain('z-[100]');
    expect(menu.className).toContain('bg-[#282828]');
  });
});
