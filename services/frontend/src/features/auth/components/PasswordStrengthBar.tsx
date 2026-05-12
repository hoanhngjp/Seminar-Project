import React from 'react';

interface PasswordStrengthBarProps {
  password: string;
}

export const PasswordStrengthBar: React.FC<PasswordStrengthBarProps> = ({ password }) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  let strengthLabel = 'Yếu';
  let colorClass = 'bg-negative text-negative';
  let width = '25%';

  if (score === 2 || score === 3) {
    strengthLabel = 'Trung bình';
    colorClass = 'bg-warning text-warning';
    width = '50%';
  } else if (score >= 4) {
    strengthLabel = 'Mạnh';
    colorClass = 'bg-spotify-green text-spotify-green';
    width = '100%';
  }
  
  if (password.length === 0) {
    return null;
  }

  const barColor = colorClass.split(' ')[0];
  const textColor = colorClass.split(' ')[1];

  return (
    <div className="flex items-center gap-sm mt-xs px-sm">
      <div className="h-[4px] w-full bg-mid-dark rounded-full overflow-hidden flex">
        <div className={`h-full ${barColor} transition-all duration-300`} style={{ width }}></div>
      </div>
      <span className={`${textColor} font-small-bold text-[12px] whitespace-nowrap`}>{strengthLabel}</span>
    </div>
  );
};
