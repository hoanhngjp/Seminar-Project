import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastProvider } from './contexts/ToastContext';
import AuthInitializer from './components/AuthInitializer';
import RequireAuth from './components/RequireAuth';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SearchPage from './pages/SearchPage';
import CreatorDashboardPage from './pages/CreatorDashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import NotificationsPage from './pages/NotificationsPage';
import PartyLandingPage from './pages/party/PartyLandingPage';
import PartyRoomPage from './pages/party/PartyRoomPage';
import UploadPage from './pages/creator/UploadPage';
import SongDetailPage from './pages/SongDetailPage';
import ArtistPage from './pages/ArtistPage';
import ProfilePage from './pages/ProfilePage';
import PreferencesPage from './pages/PreferencesPage';
import CreatorSongAnalyticsPage from './pages/creator/CreatorSongAnalyticsPage';
import BottomPlayerBar from './components/layout/BottomPlayerBar';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <ToastProvider>
      <BrowserRouter>
        <AuthInitializer>
          <Routes>
            {/* Public routes — no auth required */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Protected routes — redirect to /login if not authenticated */}
            <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
            <Route path="/search" element={<RequireAuth><SearchPage /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><CreatorDashboardPage /></RequireAuth>} />
            <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
            <Route path="/party" element={<RequireAuth><PartyLandingPage /></RequireAuth>} />
            <Route path="/party/:roomId" element={<RequireAuth><PartyRoomPage /></RequireAuth>} />
            <Route path="/songs/:songId" element={<RequireAuth><SongDetailPage /></RequireAuth>} />
            <Route path="/artists/:artistId" element={<RequireAuth><ArtistPage /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/settings/preferences" element={<RequireAuth><PreferencesPage /></RequireAuth>} />
            <Route path="/dashboard/songs/:songId" element={<RequireAuth><CreatorSongAnalyticsPage /></RequireAuth>} />
          </Routes>
        </AuthInitializer>
        {/* BottomPlayerBar lives outside <Routes> so audio state persists across navigation */}
        <BottomPlayerBar />
      </BrowserRouter>
    </ToastProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
