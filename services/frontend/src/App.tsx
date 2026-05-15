import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastProvider } from './contexts/ToastContext';
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

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/dashboard" element={<CreatorDashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/party" element={<PartyLandingPage />} />
          <Route path="/party/:roomId" element={<PartyRoomPage />} />
          <Route path="/songs/:songId" element={<SongDetailPage />} />
          <Route path="/artists/:artistId" element={<ArtistPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings/preferences" element={<PreferencesPage />} />
          <Route path="/dashboard/songs/:songId" element={<CreatorSongAnalyticsPage />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
