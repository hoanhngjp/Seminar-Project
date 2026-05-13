import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SearchPage from './pages/SearchPage';
import CreatorDashboardPage from './pages/CreatorDashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import PartyLandingPage from './pages/party/PartyLandingPage';
import PartyRoomPage from './pages/party/PartyRoomPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/dashboard" element={<CreatorDashboardPage />} />
        <Route path="/party" element={<PartyLandingPage />} />
        <Route path="/party/:roomId" element={<PartyRoomPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
