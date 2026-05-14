import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React, { createRef } from 'react';
import UserMenuDropdown from '../../../components/ui/UserMenuDropdown';
import { useAuthStore } from '../../../store/authStore';

const MOCK_PROFILE = { displayName: 'Nghiệp JP', email: 'nghieplasieunhan@gmail.com', role: 'Listener' };

function renderDropdown(props: Partial<Parameters<typeof UserMenuDropdown>[0]> = {}) {
  const anchorRef = createRef<HTMLButtonElement>();
  const onClose = vi.fn();
  const result = render(
    <MemoryRouter>
      <button ref={anchorRef}>Avatar</button>
      <UserMenuDropdown
        profile={MOCK_PROFILE}
        isOpen={true}
        onClose={onClose}
        anchorRef={anchorRef as React.RefObject<HTMLElement>}
        {...props}
      />
    </MemoryRouter>
  );
  return { ...result, onClose };
}

describe('UserMenuDropdown', () => {
  it('renders nothing when isOpen is false', () => {
    const anchorRef = createRef<HTMLButtonElement>();
    render(
      <MemoryRouter>
        <button ref={anchorRef}>Avatar</button>
        <UserMenuDropdown
          profile={MOCK_PROFILE}
          isOpen={false}
          onClose={vi.fn()}
          anchorRef={anchorRef as React.RefObject<HTMLElement>}
        />
      </MemoryRouter>
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders menu when isOpen is true', () => {
    renderDropdown();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders display name in header', () => {
    renderDropdown();
    expect(screen.getByText('Nghiệp JP')).toBeInTheDocument();
  });

  it('renders email in header', () => {
    renderDropdown();
    expect(screen.getByText('nghieplasieunhan@gmail.com')).toBeInTheDocument();
  });

  it('renders first initial as avatar', () => {
    renderDropdown();
    expect(screen.getByText('N')).toBeInTheDocument();
  });

  it('renders Profile menu item', () => {
    renderDropdown();
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
  });

  it('renders Preferences menu item', () => {
    renderDropdown();
    expect(screen.getByRole('menuitem', { name: 'Preferences' })).toBeInTheDocument();
  });

  it('renders Logout menu item', () => {
    renderDropdown();
    expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
  });

  it('Logout button has text-negative class', () => {
    renderDropdown();
    const logout = screen.getByRole('menuitem', { name: 'Logout' });
    expect(logout.className).toContain('text-negative');
  });

  it('calls onClose when clicking outside', () => {
    const { onClose } = renderDropdown();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the menu', () => {
    const { onClose } = renderDropdown();
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls clearAuth when Logout clicked', () => {
    useAuthStore.setState({ accessToken: 'tok', userId: 'u1', role: 'Listener' });
    const { onClose } = renderDropdown();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.userId).toBeNull();
    expect(state.role).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('renders ? initial when profile is null', () => {
    const anchorRef = createRef<HTMLButtonElement>();
    render(
      <MemoryRouter>
        <button ref={anchorRef}>Avatar</button>
        <UserMenuDropdown
          profile={null}
          isOpen={true}
          onClose={vi.fn()}
          anchorRef={anchorRef as React.RefObject<HTMLElement>}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('menu has bg-[#282828] and z-[100] classes', () => {
    renderDropdown();
    const menu = screen.getByRole('menu');
    expect(menu.className).toContain('bg-[#282828]');
    expect(menu.className).toContain('z-[100]');
  });
});
