import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../../components/layout/Sidebar';
import { useAuthStore } from '../../../store/authStore';

function renderSidebar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, userId: null, role: null });
});

describe('Sidebar', () => {
  it('renders main navigation landmark', () => {
    renderSidebar();
    expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeInTheDocument();
  });

  it('renders core nav items visible to all roles', () => {
    useAuthStore.setState({ accessToken: 'tok', userId: 'u1', role: 'Listener' });
    renderSidebar();
    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
    expect(screen.getByText('Tìm kiếm')).toBeInTheDocument();
    expect(screen.getByText('Thông báo')).toBeInTheDocument();
    expect(screen.getByText('Listening Party')).toBeInTheDocument();
  });

  it('hides Creator-only items for Listener role', () => {
    useAuthStore.setState({ accessToken: 'tok', userId: 'u1', role: 'Listener' });
    renderSidebar();
    expect(screen.queryByText('Tải nhạc lên')).not.toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });

  it('shows Creator-only items for Creator role', () => {
    useAuthStore.setState({ accessToken: 'tok', userId: 'u1', role: 'Creator' });
    renderSidebar();
    expect(screen.getByText('Tải nhạc lên')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('shows Creator-only items for Admin role', () => {
    useAuthStore.setState({ accessToken: 'tok', userId: 'u1', role: 'Admin' });
    renderSidebar();
    expect(screen.getByText('Tải nhạc lên')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('marks active link with aria-current=page', () => {
    useAuthStore.setState({ accessToken: 'tok', userId: 'u1', role: 'Listener' });
    renderSidebar('/search');
    const searchLink = screen.getByText('Tìm kiếm').closest('a');
    expect(searchLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark inactive links with aria-current', () => {
    useAuthStore.setState({ accessToken: 'tok', userId: 'u1', role: 'Listener' });
    renderSidebar('/search');
    const homeLink = screen.getByText('Trang chủ').closest('a');
    expect(homeLink).not.toHaveAttribute('aria-current');
  });
});
