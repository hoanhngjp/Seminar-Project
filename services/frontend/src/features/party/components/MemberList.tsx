import type { PartyMember } from '../../../types/domain';

interface Props {
  members: PartyMember[];
  currentUserId?: string;
  onInvite?: () => void;
}

export default function MemberList({ members, currentUserId, onInvite }: Props) {
  const host    = members.find((m) => m.isHost);
  const others  = members.filter((m) => !m.isHost);

  return (
    <div className="bg-dark-surface rounded-[8px] p-6 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] border border-transparent h-full flex flex-col relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-dark-surface to-near-black opacity-50 z-0 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-muted">
          <h3 className="font-feature-heading text-feature-heading text-text-emphasis">
            Thành viên ({members.length})
          </h3>
          <span className="material-symbols-outlined text-text-secondary" aria-hidden="true">people</span>
        </div>

        {/* Member rows */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">

          {/* Host row */}
          {host && (
            <MemberRow
              member={host}
              isCurrentUser={host.userId === currentUserId}
              isHost
            />
          )}

          {/* Regular members */}
          {others.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isCurrentUser={m.userId === currentUserId}
              isHost={false}
            />
          ))}
        </div>

        {/* Invite button */}
        <div className="mt-4 pt-4 border-t border-border-muted">
          <button
            onClick={onInvite}
            aria-label="Mời bạn bè"
            className="w-full border-2 border-dashed border-border-muted hover:border-spotify-green rounded-[8px] py-4 flex flex-col items-center justify-center gap-2 group transition-colors bg-near-black/30 hover:bg-mid-dark/20"
          >
            <div className="w-10 h-10 rounded-full bg-mid-dark group-hover:bg-spotify-green/20 flex items-center justify-center transition-colors">
              <span
                className="material-symbols-outlined text-text-secondary group-hover:text-spotify-green transition-colors"
                aria-hidden="true"
              >
                person_add
              </span>
            </div>
            <span className="font-small-bold text-small-bold text-text-secondary group-hover:text-spotify-green transition-colors">
              + Mời bạn bè
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-component ─────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: PartyMember;
  isCurrentUser: boolean;
  isHost: boolean;
}

function MemberRow({ member, isHost }: MemberRowProps) {
  return (
    <div
      className="flex items-center justify-between group hover:bg-mid-dark/50 p-2 rounded-md transition-colors"
      aria-label={`${member.name}${isHost ? ' — Chủ phòng' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={`${member.name} avatar`}
              className={`w-12 h-12 rounded-full object-cover ${isHost ? 'border-2 border-transparent group-hover:border-spotify-green transition-colors' : ''}`}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-mid-dark flex items-center justify-center text-text-secondary border border-border-muted">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person</span>
            </div>
          )}
          {/* Online dot */}
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-spotify-green border-2 border-dark-surface rounded-full" />
        </div>

        <div>
          <p className={`font-body-bold text-body-bold ${isHost ? 'text-text-base' : 'text-text-secondary group-hover:text-text-base transition-colors'}`}>
            {member.name}
          </p>
          {isHost ? (
            <span className="text-warning text-[10px] uppercase font-bold flex items-center gap-1 mt-0.5">
              <span className="material-symbols-outlined text-[12px]" aria-hidden="true">kid_star</span>
              Chủ phòng
            </span>
          ) : (
            <span className="text-text-secondary text-[10px] uppercase font-bold mt-0.5 inline-block">
              Thành viên
            </span>
          )}
        </div>
      </div>

      {isHost && (
        <button
          className="text-text-secondary hover:text-text-base opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Tùy chọn"
        >
          <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
        </button>
      )}
    </div>
  );
}
