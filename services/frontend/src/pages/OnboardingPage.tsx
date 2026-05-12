import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { userService } from '../services/userService';
import { GenreGrid } from '../features/onboarding/components/GenreGrid';
import { ArtistGrid } from '../features/onboarding/components/ArtistGrid';
import Spinner from '../components/ui/Spinner';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { accessToken, hasCompletedOnboarding, completeOnboarding } = useAuthStore();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Protection: redirect if not logged in or already completed onboarding
  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
    } else if (hasCompletedOnboarding) {
      navigate('/');
    }
  }, [accessToken, hasCompletedOnboarding, navigate]);

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const toggleArtist = (id: string) => {
    setSelectedArtists((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleNextToStep2 = () => {
    if (selectedGenres.length >= 3) setStep(2);
  };

  const handleFinishStep2 = async () => {
    if (selectedArtists.length < 3) return;
    
    setLoading(true);
    try {
      await userService.updatePreferences({
        preferredGenres: selectedGenres,
        preferredArtists: selectedArtists,
        audioQuality: "standard"
      });
      // Move to step 3 completion screen
      setStep(3);
    } catch (error) {
      console.error("Failed to update preferences:", error);
      // In a real app, we might show a toast error here.
    } finally {
      setLoading(false);
    }
  };

  const handleExplore = () => {
    completeOnboarding();
    navigate('/');
  };

  if (step === 3) {
    return (
      <div className="bg-near-black text-text-base font-body-regular min-h-screen flex flex-col items-center justify-center">
        <main className="w-full max-w-[480px] mx-auto px-lg flex flex-col items-center">
          {/* Stepper */}
          <div className="w-full mb-xl flex items-center justify-between opacity-80">
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-xs flex-1">
              <div className="w-8 h-8 rounded-full bg-spotify-green flex items-center justify-center text-near-black">
                <span className="material-symbols-outlined text-[16px]">check</span>
              </div>
              <span className="font-micro text-micro text-spotify-green">Tài khoản</span>
            </div>
            <div className="h-[2px] bg-spotify-green flex-1 mx-xs"></div>
            {/* Step 2 */}
            <div className="flex flex-col items-center gap-xs flex-1">
              <div className="w-8 h-8 rounded-full bg-spotify-green flex items-center justify-center text-near-black">
                <span className="material-symbols-outlined text-[16px]">check</span>
              </div>
              <span className="font-micro text-micro text-spotify-green">Sở thích</span>
            </div>
            <div className="h-[2px] bg-spotify-green flex-1 mx-xs"></div>
            {/* Step 3 (Active) */}
            <div className="flex flex-col items-center gap-xs flex-1">
              <div className="w-8 h-8 rounded-full bg-spotify-green border-2 border-spotify-green flex items-center justify-center text-near-black font-small-bold text-small-bold">3</div>
              <span className="font-micro text-micro text-spotify-green font-bold">Hoàn tất</span>
            </div>
          </div>
          
          {/* Completion Content */}
          <div className="flex flex-col items-center text-center mt-xl mb-xl">
            {/* Large Checkmark Icon */}
            <div className="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center mb-lg shadow-lg" style={{ boxShadow: 'rgba(0,0,0,0.5) 0px 8px 24px' }}>
              <span className="material-symbols-outlined text-spotify-green" style={{ fontSize: '64px' }}>check_circle</span>
            </div>
            {/* Titles */}
            <h1 className="font-section-title text-section-title mb-sm">Tất cả đã sẵn sàng!</h1>
            <p className="font-caption text-caption text-text-secondary">Chúng tôi đã cá nhân hóa playlist cho bạn</p>
          </div>
          
          {/* Action Button */}
          <div className="w-full mt-lg">
            <button 
              onClick={handleExplore}
              className="w-full bg-spotify-green text-[#000000] font-button-uppercase text-button-uppercase py-md rounded-full hover:scale-105 active:scale-95 transition-transform shadow-md" 
              style={{ boxShadow: 'rgba(0,0,0,0.3) 0px 8px 8px' }}
            >
              KHÁM PHÁ NGAY
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="bg-near-black text-text-base font-body-regular min-h-screen flex flex-col items-center justify-center pt-xl pb-xl px-md">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-base mb-xl w-full max-w-[512px]">
          <div className="flex items-center gap-sm">
            <div className="w-2 h-2 rounded-full bg-spotify-green"></div>
            <span className="font-small-bold text-small-bold text-text-base">Chọn thể loại</span>
          </div>
          <div className="w-8 h-px bg-border-muted"></div>
          <div className="flex items-center gap-sm">
            <div className="w-2 h-2 rounded-full bg-border-muted"></div>
            <span className="font-small-bold text-small-bold text-text-secondary">Chọn nghệ sĩ</span>
          </div>
          <div className="w-8 h-px bg-border-muted"></div>
          <div className="flex items-center gap-sm">
            <div className="w-2 h-2 rounded-full bg-border-muted"></div>
            <span className="font-small-bold text-small-bold text-text-secondary">Hoàn tất</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-lg">
          <h1 className="font-section-title text-section-title text-text-base mb-sm">Bạn thích thể loại nhạc nào?</h1>
          <p className="font-caption text-caption text-text-secondary">Chọn ít nhất 3 thể loại để bắt đầu</p>
        </div>

        {/* Main Content Area */}
        <main className="w-full max-w-3xl flex-grow flex flex-col items-center">
          <GenreGrid selectedGenres={selectedGenres} toggleGenre={toggleGenre} />

          {/* Bottom Controls */}
          <div className="w-full max-w-[384px] mt-auto flex flex-col items-center">
            {/* Progress Status */}
            <div className="w-full mb-md">
              <div className="flex justify-between items-center mb-xs">
                <span className="font-caption text-caption text-text-secondary">Đã chọn: {selectedGenres.length}/3</span>
              </div>
              <div className="h-1 bg-mid-dark rounded-full overflow-hidden">
                <div 
                  className="h-full bg-spotify-green transition-all duration-300" 
                  style={{ width: `${Math.min(100, (selectedGenres.length / 3) * 100)}%` }}
                ></div>
              </div>
            </div>
            
            {/* Primary Action */}
            <button 
              onClick={handleNextToStep2}
              disabled={selectedGenres.length < 3}
              className={`w-full py-md rounded-full font-button-uppercase text-button-uppercase mb-md transition-all ${
                selectedGenres.length >= 3 
                  ? 'bg-spotify-green text-[#000000] hover:scale-105 active:scale-95 cursor-pointer shadow-[rgba(0,0,0,0.3)_0px_4px_12px]' 
                  : 'bg-border-muted text-text-secondary cursor-not-allowed'
              }`}
            >
              TIẾP THEO →
            </button>
            
            {/* Secondary Action */}
            <button className="font-caption text-caption text-text-secondary hover:text-text-base transition-colors underline">
              BỎ QUA
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="bg-near-black text-text-base font-body-regular min-h-screen flex flex-col pb-32 selection:bg-spotify-green selection:text-near-black">
        <main className="flex-1 w-full max-w-screen-md mx-auto px-lg py-xl flex flex-col pt-16">
          {/* Top Stepper */}
          <div className="flex items-center gap-sm justify-center mb-xl w-full max-w-[200px] mx-auto">
            <div className="h-1 flex-1 bg-spotify-green rounded-full opacity-50"></div>
            <div className="h-1 flex-1 bg-spotify-green rounded-full"></div>
            <div className="h-1 flex-1 bg-surface-variant rounded-full"></div>
          </div>
          
          {/* Header Area */}
          <header className="text-center mb-xl">
            <h1 className="font-section-title text-section-title text-text-base mb-xs tracking-tight">Chọn nghệ sĩ bạn yêu thích</h1>
            <p className="font-caption text-caption text-text-secondary">Chọn ít nhất 3 nghệ sĩ</p>
          </header>

          {/* Artist Grid */}
          <ArtistGrid selectedArtists={selectedArtists} toggleArtist={toggleArtist} />
        </main>

        {/* Fixed Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 w-full bg-dark-surface z-50 shadow-[rgba(0,0,0,0.5)_0px_-8px_24px]">
          {/* Progress Indicator */}
          <div className="w-full h-1 bg-mid-dark">
            <div 
              className="h-full bg-spotify-green transition-all duration-500 ease-out" 
              style={{ width: `${Math.min(100, (selectedArtists.length / 3) * 100)}%` }}
            ></div>
          </div>
          
          {/* Controls */}
          <div className="max-w-screen-md mx-auto px-lg py-md flex items-center justify-between gap-md">
            <div className="flex items-center gap-sm">
              <span className={`font-body-bold text-body-bold ${selectedArtists.length >= 3 ? 'text-spotify-green' : 'text-text-secondary'}`}>
                Đã chọn: {selectedArtists.length}/3
              </span>
            </div>
            
            <button 
              onClick={handleFinishStep2}
              disabled={selectedArtists.length < 3 || loading}
              className={`px-lg py-sm rounded-full font-button-uppercase text-button-uppercase transition-transform shadow-[rgba(0,0,0,0.3)_0px_4px_12px] flex items-center gap-xs ${
                selectedArtists.length >= 3 && !loading
                  ? 'bg-spotify-green text-[#000000] hover:scale-105 active:scale-95 cursor-pointer'
                  : 'bg-border-muted text-text-secondary cursor-not-allowed'
              }`}
            >
              {loading ? <Spinner size="sm" /> : 'TIẾP THEO'}
              {!loading && <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'wght' 700" }}>arrow_forward</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
