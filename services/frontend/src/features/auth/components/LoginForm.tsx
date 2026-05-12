import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const LoginForm: React.FC = () => {
  const { login, loading, errorMsg, isLocked } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password });
  };

  if (isLocked) {
    return (
      <div className="w-full max-w-[480px] bg-dark-surface rounded-[8px] p-xl relative overflow-hidden shadow-[rgba(0,0,0,0.5)_0px_8px_24px]">
        {/* Background Decorative Blur */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-spotify-green rounded-full mix-blend-screen filter blur-[100px] opacity-20 pointer-events-none"></div>
        <div className="text-center mb-xl relative z-10">
          <h1 className="font-section-title text-section-title text-text-base mb-sm font-bold">Log in to SoundWave</h1>
          <p className="font-body-regular text-body-regular text-text-secondary">Welcome back to the music.</p>
        </div>
        
        {/* Account Locked Banner */}
        <div className="bg-[rgba(243,114,127,0.1)] border-l-[3px] border-negative p-md rounded-r-md mb-xl relative z-10 flex items-start gap-md">
          <span className="material-symbols-outlined text-negative" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
          <p className="text-negative font-caption text-caption">
            Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau.
          </p>
        </div>
        
        <form className="space-y-lg relative z-10">
          <div className="space-y-xs">
            <label className="block font-small-bold text-small-bold text-text-base" htmlFor="emailLocked">Email or username</label>
            <input 
              className="w-full bg-mid-dark text-text-base font-body-regular text-body-regular rounded-full py-md px-lg focus:outline-none focus:ring-2 focus:ring-spotify-green shadow-[inset_0px_1px_0px_rgb(18,18,18),inset_0px_0px_0px_1px_rgb(124,124,124)] border-none placeholder:text-text-secondary disabled:opacity-50" 
              disabled 
              id="emailLocked" 
              placeholder="Email or username" 
              type="email" 
            />
          </div>
          <div className="space-y-xs">
            <label className="block font-small-bold text-small-bold text-text-base" htmlFor="passwordLocked">Password</label>
            <input 
              className="w-full bg-mid-dark text-text-base font-body-regular text-body-regular rounded-full py-md px-lg focus:outline-none focus:ring-2 focus:ring-spotify-green shadow-[inset_0px_1px_0px_rgb(18,18,18),inset_0px_0px_0px_1px_rgb(124,124,124)] border-none placeholder:text-text-secondary disabled:opacity-50" 
              disabled 
              id="passwordLocked" 
              placeholder="Password" 
              type="password" 
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-sm cursor-not-allowed">
              <input className="w-5 h-5 rounded-[4px] bg-mid-dark border-border-pill text-spotify-green disabled:opacity-50" disabled type="checkbox" />
              <span className="font-caption text-caption text-text-secondary">Remember me</span>
            </label>
            <span className="font-caption text-caption text-text-base opacity-50 pointer-events-none">Forgot password?</span>
          </div>
          <button 
            className="w-full bg-mid-dark text-text-base font-button-uppercase text-button-uppercase py-md px-lg rounded-full border border-border-pill opacity-50 cursor-not-allowed uppercase tracking-[1.4px]" 
            disabled 
            type="submit"
          >
            LOG IN
          </button>
        </form>
        
        <div className="mt-xl mb-lg flex items-center gap-md relative z-10 opacity-50">
          <div className="h-[1px] bg-border-muted flex-grow"></div>
          <span className="font-caption text-caption text-text-secondary">OR</span>
          <div className="h-[1px] bg-border-muted flex-grow"></div>
        </div>
        <div className="space-y-md relative z-10 opacity-50">
          <button className="w-full bg-transparent border border-border-pill text-text-base font-button-uppercase text-button-uppercase py-md px-lg rounded-full flex items-center justify-center gap-sm cursor-not-allowed" disabled>
            Continue with Google
          </button>
        </div>
        <div className="mt-xl text-center relative z-10">
          <p className="font-caption text-caption text-text-secondary">
            Don't have an account? 
            <span className="text-text-base font-body-bold text-body-bold ml-sm opacity-50 cursor-not-allowed pointer-events-none">Sign up for SoundWave</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[480px]">
      <div className="bg-dark-surface rounded-[8px] p-[48px] shadow-[rgba(0,0,0,0.5)_0px_8px_24px]">
        {/* Header */}
        <div className="flex flex-col items-center mb-xl">
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-spotify-green text-[32px] font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>music_note</span>
            <h1 className="font-section-title text-section-title text-text-base font-bold">SoundWave</h1>
          </div>
          <p className="font-caption text-caption text-text-secondary">Nghe nhạc không giới hạn</p>
        </div>
        
        {/* Form */}
        <form className="flex flex-col gap-lg" onSubmit={handleSubmit}>
          {/* Username Input */}
          <div className="flex flex-col gap-sm">
            <label className="font-body-bold text-body-bold text-text-base" htmlFor="username">Email hoặc tên người dùng</label>
            <div className="relative">
              <input 
                className={`w-full bg-mid-dark text-text-base rounded-full py-[12px] px-[20px] shadow-[inset_0px_1px_0px_rgb(18,18,18),inset_0px_0px_0px_1px_rgb(124,124,124)] border-none focus:ring-0 focus:outline-none placeholder:text-text-secondary font-body-regular text-body-regular transition-colors duration-200 focus:bg-dark-card ${errorMsg ? 'border-2 border-negative' : ''}`}
                id="username" 
                placeholder="email@example.com" 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            {errorMsg && (
              <div className="flex items-center gap-xs mt-xs text-negative">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                <span className="font-small-bold text-small-bold">{errorMsg}</span>
              </div>
            )}
          </div>
          
          {/* Password Input */}
          <div className="flex flex-col gap-xs">
            <div className="flex flex-col gap-sm relative">
              <label className="font-body-bold text-body-bold text-text-base" htmlFor="password">Mật khẩu</label>
              <div className="relative w-full">
                <input 
                  className="w-full bg-mid-dark text-text-base rounded-full py-[12px] pl-[20px] pr-[48px] shadow-[inset_0px_1px_0px_rgb(18,18,18),inset_0px_0px_0px_1px_rgb(124,124,124)] border-none focus:ring-0 focus:outline-none placeholder:text-text-secondary font-body-regular text-body-regular transition-colors duration-200 focus:bg-dark-card" 
                  id="password" 
                  placeholder="Nhập mật khẩu" 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  className="absolute right-[20px] top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-base transition-colors duration-200" 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <div className="flex justify-end mt-xs">
              <a className="font-caption text-caption text-spotify-green hover:underline" href="#">Quên mật khẩu?</a>
            </div>
          </div>
          
          {/* Submit Button */}
          <button 
            className="w-full bg-spotify-green text-near-black font-button-uppercase text-button-uppercase py-md rounded-full mt-sm hover:scale-105 active:scale-95 transition-transform duration-200 disabled:opacity-50" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
          </button>
        </form>
        
        {/* Divider */}
        <div className="flex items-center gap-md my-xl">
          <div className="flex-grow h-px bg-border-muted"></div>
          <span className="font-caption text-caption text-text-secondary">hoặc</span>
          <div className="flex-grow h-px bg-border-muted"></div>
        </div>
        
        {/* Social Login */}
        <button 
          className="w-full flex items-center justify-center gap-sm bg-mid-dark border border-border-muted text-text-base font-body-bold text-body-bold py-[12px] px-[20px] rounded-full hover:bg-dark-card hover:scale-[1.02] active:scale-95 transition-all duration-200 mb-xl" 
          type="button"
        >
          <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
          </svg>
          Tiếp tục với Google
        </button>
        
        {/* Footer Link */}
        <div className="text-center">
          <p className="font-caption text-caption text-text-secondary">
            Chưa có tài khoản? <Link className="text-text-base hover:text-spotify-green hover:underline font-body-bold" to="/register">Đăng ký</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
