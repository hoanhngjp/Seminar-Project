import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'pill-dark' | 'outlined' | 'circular';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?:    ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-spotify-green text-near-black font-bold tracking-widest uppercase rounded-full ' +
    'hover:scale-105 active:scale-95 transition-transform duration-200',
  'pill-dark':
    'bg-mid-dark text-text-base rounded-full ' +
    'hover:bg-dark-card active:scale-95 transition-all duration-200',
  outlined:
    'border border-border-pill text-text-base rounded-full bg-transparent ' +
    'hover:border-text-base active:scale-95 transition-all duration-200',
  circular:
    'bg-spotify-green text-near-black rounded-full flex items-center justify-center flex-shrink-0 ' +
    'hover:scale-105 active:scale-95 transition-transform duration-200',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-1.5 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

const circularSizeClasses: Record<ButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export default function Button({
  variant = 'primary',
  size    = 'md',
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const isCircular = variant === 'circular';
  const sizeClass  = isCircular ? circularSizeClasses[size] : sizeClasses[size];

  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        variantClasses[variant],
        sizeClass,
        disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}
