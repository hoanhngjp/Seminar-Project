import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';

export const LoginForm: React.FC = () => {
  const { login, googleLogin, loading, errorMsg, isLocked } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
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
              className="w-full bg-mid-dark text-text-base font-body-regular text-body-regular rounded-full py-md px-lg focus:outline-none focus:ring-2 focus:ring-spotify-green shadow-input-inset border-none placeholder:text-text-secondary disabled:opacity-50"
              disabled
              id="emailLocked" 
              placeholder="Email or username" 
              type="email" 
            />
          </div>
          <div className="space-y-xs">
            <label className="block font-small-bold text-small-bold text-text-base" htmlFor="passwordLocked">Password</label>
            <input 
              className="w-full bg-mid-dark text-text-base font-body-regular text-body-regular rounded-full py-md px-lg focus:outline-none focus:ring-2 focus:ring-spotify-green shadow-input-inset border-none placeholder:text-text-secondary disabled:opacity-50"
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
          {/* Email Input */}
          <div className="flex flex-col gap-sm">
            <label className="font-body-bold text-body-bold text-text-base" htmlFor="email">Email</label>
            <div className="relative">
              <input
                className={`w-full bg-mid-dark text-text-base rounded-full py-[12px] px-[20px] shadow-input-inset border-none focus:ring-0 focus:outline-none placeholder:text-text-secondary font-body-regular text-body-regular transition-colors duration-200 focus:bg-dark-card ${errorMsg ? 'ring-2 ring-negative' : ''}`}
                id="email"
                placeholder="email@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  className="w-full bg-mid-dark text-text-base rounded-full py-[12px] pl-[20px] pr-[48px] shadow-input-inset border-none focus:ring-0 focus:outline-none placeholder:text-text-secondary font-body-regular text-body-regular transition-colors duration-200 focus:bg-dark-card" 
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
        
        {/* Social Login — GoogleLogin component provides id_token for backend verification */}
        <div className="flex justify-center mb-xl">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (credentialResponse.credential) {
                googleLogin(credentialResponse.credential);
              }
            }}
            onError={() => {}}
            theme="filled_black"
            shape="pill"
            text="continue_with"
            locale="vi"
          />
        </div>
        
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
