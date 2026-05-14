import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
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
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
