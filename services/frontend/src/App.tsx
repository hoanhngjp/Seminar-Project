import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/search" element={<div>Search Page (placeholder)</div>} />
        <Route path="/party/:roomId" element={<div>Listening Party (placeholder)</div>} />
        <Route path="/dashboard" element={<div>Creator Dashboard (placeholder)</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
