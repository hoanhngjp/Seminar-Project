import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SearchPage from './pages/SearchPage';
import CreatorDashboardPage from './pages/CreatorDashboardPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/dashboard" element={<CreatorDashboardPage />} />
        <Route path="/party/:roomId" element={<div>Listening Party (placeholder)</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
