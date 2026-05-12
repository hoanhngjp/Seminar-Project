import { useState, type InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?:        string;
  error?:        string;
  /** Show password visibility toggle — only for type="password" */
  passwordToggle?: boolean;
  className?:    string;
}

export default function Input({
  label,
  error,
  passwordToggle,
  type    = 'text',
  id,
  className = '',
  ...rest
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = passwordToggle
    ? showPassword ? 'text' : 'password'
    : type;

  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-text-secondary text-caption text-sm font-medium"
        >
          {label}
        </label>
      )}

      <div className="relative w-full">
        <input
          {...rest}
          id={inputId}
          type={inputType}
          className={[
            'w-full bg-mid-dark rounded-full py-3 px-5',
            'text-text-base placeholder:text-text-secondary',
            'input-inset border-none',
            'focus:bg-dark-card focus:outline-none',
            'transition-colors duration-200',
            error ? 'ring-1 ring-negative' : '',
            passwordToggle ? 'pr-12' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />

        {passwordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-base transition-colors"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            tabIndex={-1}
          >
            <span className="material-symbols-outlined text-[20px]">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-negative text-xs mt-0.5 px-2"
        >
          {error}
        </p>
      )}
    </div>
  );
}
