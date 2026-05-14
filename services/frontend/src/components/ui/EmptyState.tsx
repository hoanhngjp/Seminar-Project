import React from 'react';

const ICON_MAP: Record<EmptyStateVariant, string> = {
  music: 'music_note',
  search: 'search_off',
  bell: 'notifications_off',
  group: 'groups',
};

type EmptyStateVariant = 'music' | 'search' | 'bell' | 'group';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ variant, title, description, ctaLabel, onCta }: EmptyStateProps) {
  const icon = ICON_MAP[variant];

  return (
    <div className="flex flex-col items-center gap-4 py-12 px-4 text-center">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-mid-dark">
        <span className="material-symbols-outlined text-4xl text-text-secondary" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-text-primary">{title}</p>
        {description && (
          <p className="text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-2 px-6 py-2 rounded-full bg-spotify-green text-near-black text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
