import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PasswordStrengthBar } from './PasswordStrengthBar';

export const RegisterForm: React.FC = () => {
  const { register, loading, errorMsg } = useAuth();
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'Listener' | 'Creator'>('Listener');
  const [terms, setTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (password !== confirmPassword) {
      setValidationError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!terms) {
      setValidationError('Bạn phải đồng ý với Điều khoản dịch vụ.');
      return;
    }
    register({ fullname, email, password, role });
  };

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  return (
    <div className="bg-dark-surface rounded-[8px] p-[48px] w-full max-w-[480px] shadow-level-3 flex flex-col gap-[32px]">
      {/* Header */}
      <header className="flex flex-col items-center">
        <div className="flex items-center gap-sm text-text-base">
          <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>music_note</span>
          <h1 className="font-section-title text-section-title">SoundWave</h1>
        </div>
        <h2 className="font-feature-heading text-feature-heading text-text-base mt-sm">Tạo tài khoản miễn phí</h2>
      </header>
      
      {/* Form */}
      <form className="flex flex-col gap-md" onSubmit={handleSubmit}>
        {/* Họ và tên */}
        <div className="flex flex-col gap-xs">
          <label className="font-body-bold text-[14px] text-text-base" htmlFor="fullname">Họ và tên</label>
          <input 
            className="bg-mid-dark rounded-full py-[12px] px-lg text-text-base placeholder:text-text-secondary w-full focus:outline-none shadow-input-inset font-body-regular text-body-regular border-none focus:ring-2 focus:ring-spotify-green" 
            id="fullname" 
            placeholder="Nguyễn Văn A" 
            type="text" 
            value={fullname}
            onChange={(e) => setFullname(e.target.value)}
            required
          />
        </div>
        
        {/* Email */}
        <div className="flex flex-col gap-xs">
          <label className="font-body-bold text-[14px] text-text-base" htmlFor="email">Email</label>
          <input 
            className="bg-mid-dark rounded-full py-[12px] px-lg text-text-base placeholder:text-text-secondary w-full focus:outline-none shadow-input-inset font-body-regular text-body-regular border-none focus:ring-2 focus:ring-spotify-green" 
            id="email" 
            placeholder="email@example.com" 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        {/* Mật khẩu */}
        <div className="flex flex-col gap-xs">
          <label className="font-body-bold text-[14px] text-text-base" htmlFor="password">Mật khẩu</label>
          <div className="relative w-full">
            <input 
              className="bg-mid-dark rounded-full py-[12px] pl-lg pr-[48px] text-text-base placeholder:text-text-secondary w-full focus:outline-none shadow-input-inset font-body-regular text-body-regular border-none focus:ring-2 focus:ring-spotify-green" 
              id="password" 
              placeholder="Tối thiểu 8 ký tự" 
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <button 
              className="absolute right-lg top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-base transition-colors" 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <PasswordStrengthBar password={password} />
        </div>
        
        {/* Xác nhận mật khẩu */}
        <div className="flex flex-col gap-xs">
          <label className="font-body-bold text-[14px] text-text-base" htmlFor="confirm-password">Xác nhận mật khẩu</label>
          <div className="relative w-full">
            <input 
              className="bg-mid-dark rounded-full py-[12px] pl-lg pr-[48px] text-text-base placeholder:text-text-secondary w-full focus:outline-none shadow-input-inset font-body-regular text-body-regular border-none focus:ring-2 focus:ring-spotify-green" 
              id="confirm-password" 
              placeholder="Nhập lại mật khẩu" 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {passwordsMatch && (
              <span className="material-symbols-outlined absolute right-lg top-1/2 -translate-y-1/2 text-spotify-green" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            )}
          </div>
        </div>
        
        {/* Vai trò */}
        <div className="flex flex-col gap-xs">
          <label className="font-body-bold text-[14px] text-text-base">Bạn là:</label>
          <div className="flex gap-sm w-full">
            <button 
              className={`flex-1 font-body-bold text-[14px] py-[10px] rounded-full flex items-center justify-center gap-xs transition-colors ${role === 'Listener' ? 'bg-spotify-green text-near-black' : 'bg-mid-dark text-text-secondary shadow-input-inset hover:text-text-base'}`} 
              type="button"
              onClick={() => setRole('Listener')}
            >
              🎧 Người nghe
            </button>
            <button 
              className={`flex-1 font-body-bold text-[14px] py-[10px] rounded-full flex items-center justify-center gap-xs transition-colors ${role === 'Creator' ? 'bg-spotify-green text-near-black' : 'bg-mid-dark text-text-secondary shadow-input-inset hover:text-text-base'}`} 
              type="button"
              onClick={() => setRole('Creator')}
            >
              🎵 Nghệ sĩ
            </button>
          </div>
        </div>
        
        {/* Terms Checkbox */}
        <div className="flex items-start gap-sm mt-sm">
          <div className="relative flex items-center justify-center w-[16px] h-[16px] mt-[2px]">
            <input 
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="appearance-none w-[16px] h-[16px] border border-border-pill rounded-[4px] bg-mid-dark checked:bg-spotify-green checked:border-spotify-green cursor-pointer" 
              id="terms" 
              type="checkbox" 
            />
            <span className="material-symbols-outlined absolute text-near-black text-[14px] pointer-events-none opacity-0 checked-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
            <style>{`#terms:checked + .checked-icon { opacity: 1; }`}</style>
          </div>
          <label className="font-caption text-[12px] text-text-secondary leading-tight cursor-pointer" htmlFor="terms">
            Tôi đồng ý với <a className="text-spotify-green hover:underline" href="#">Điều khoản dịch vụ</a> và <a className="text-spotify-green hover:underline" href="#">Chính sách bảo mật</a>
          </label>
        </div>

        {(errorMsg || validationError) && (
          <div className="flex items-center gap-xs mt-xs text-negative">
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <span className="font-small-bold text-small-bold">{validationError || errorMsg}</span>
          </div>
        )}
        
        {/* Submit Button */}
        <button 
          className="w-full bg-spotify-green text-near-black font-button-uppercase text-button-uppercase rounded-full py-[14px] hover:scale-105 active:scale-95 transition-transform mt-sm disabled:opacity-50" 
          type="submit"
          disabled={loading}
        >
          {loading ? 'ĐANG XỬ LÝ...' : 'TẠO TÀI KHOẢN'}
        </button>
      </form>
      
      {/* Footer */}
      <div className="text-center">
        <p className="font-caption text-caption text-text-secondary">
          Đã có tài khoản? <Link className="text-spotify-green hover:underline font-bold" to="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
};
