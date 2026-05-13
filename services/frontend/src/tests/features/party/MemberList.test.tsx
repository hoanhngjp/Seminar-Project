import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MemberList from '../../../features/party/components/MemberList';
import type { PartyMember } from '../../../types/domain';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const HOST: PartyMember    = { userId: 'u-001', name: 'Nghiệp', isHost: true,  avatarUrl: 'https://picsum.photos/seed/u001/100/100' };
const MEMBER1: PartyMember = { userId: 'u-002', name: 'Linh',   isHost: false, avatarUrl: 'https://picsum.photos/seed/u002/100/100' };
const MEMBER2: PartyMember = { userId: 'u-003', name: 'Hải',    isHost: false };

const MEMBERS = [HOST, MEMBER1, MEMBER2];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemberList', () => {

  describe('Header', () => {
    it('displays member count', () => {
      render(<MemberList members={MEMBERS} />);
      expect(screen.getByText('Thành viên (3)')).toBeInTheDocument();
    });
  });

  describe('Host row', () => {
    it('shows host name', () => {
      render(<MemberList members={MEMBERS} />);
      expect(screen.getByText('Nghiệp')).toBeInTheDocument();
    });

    it('shows Chủ phòng badge for host', () => {
      render(<MemberList members={MEMBERS} />);
      expect(screen.getByText('Chủ phòng')).toBeInTheDocument();
    });

    it('renders host avatar image', () => {
      render(<MemberList members={MEMBERS} />);
      expect(screen.getByAltText('Nghiệp avatar')).toBeInTheDocument();
    });
  });

  describe('Member rows', () => {
    it('shows regular member names', () => {
      render(<MemberList members={MEMBERS} />);
      expect(screen.getByText('Linh')).toBeInTheDocument();
      expect(screen.getByText('Hải')).toBeInTheDocument();
    });

    it('shows Thành viên badge for members', () => {
      render(<MemberList members={MEMBERS} />);
      const badges = screen.getAllByText('Thành viên');
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it('shows person icon placeholder when member has no avatar', () => {
      render(<MemberList members={MEMBERS} />);
      // Hải has no avatar — person icon placeholder
      expect(screen.getByAltText('Linh avatar')).toBeInTheDocument();
      // Hải has no avatarUrl so no alt='Hải avatar'
      expect(screen.queryByAltText('Hải avatar')).not.toBeInTheDocument();
    });
  });

  describe('Invite button', () => {
    it('renders invite button', () => {
      render(<MemberList members={MEMBERS} />);
      expect(screen.getByRole('button', { name: /Mời bạn bè/ })).toBeInTheDocument();
    });

    it('calls onInvite when invite button is clicked', () => {
      const onInvite = vi.fn();
      render(<MemberList members={MEMBERS} onInvite={onInvite} />);
      fireEvent.click(screen.getByRole('button', { name: /Mời bạn bè/ }));
      expect(onInvite).toHaveBeenCalledOnce();
    });
  });

  describe('Edge case', () => {
    it('renders correctly with only host (no members)', () => {
      render(<MemberList members={[HOST]} />);
      expect(screen.getByText('Thành viên (1)')).toBeInTheDocument();
      expect(screen.getByText('Chủ phòng')).toBeInTheDocument();
    });
  });

});
