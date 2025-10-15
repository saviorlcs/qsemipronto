import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Shop from './pages/Shop';
import Settings from './pages/Settings';
import Friends from './pages/Friends';
import NicknameSetup from './pages/NicknameSetup';
import { Toaster } from './components/ui/sonner';
import '@/App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function AuthHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const sessionId = params.get('session_id');

      if (sessionId) {
        try {
          await axios.get(`${API}/auth/session?session_id=${sessionId}`, {
            withCredentials: true
          });
          window.location.hash = '';
          // Check if user has nickname
          const userRes = await axios.get(`${API}/auth/me`, { withCredentials: true });
          if (!userRes.data.nickname || !userRes.data.tag) {
            navigate('/setup', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } catch (error) {
          console.error('Session error:', error);
          setIsChecking(false);
        }
      } else {
        try {
          const userRes = await axios.get(`${API}/auth/me`, { withCredentials: true });
          if (location.pathname === '/') {
            if (!userRes.data.nickname || !userRes.data.tag) {
              navigate('/setup', { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          } else if (location.pathname !== '/setup' && (!userRes.data.nickname || !userRes.data.tag)) {
            navigate('/setup', { replace: true });
          }
        } catch (error) {
          if (location.pathname !== '/') {
            navigate('/', { replace: true });
          }
        }
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [navigate, location]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900">
        <div className="text-xl font-medium text-white">Carregando...</div>
      </div>
    );
  }

  return null;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthHandler />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/setup" element={<NicknameSetup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/loja" element={<Shop />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/amigos" element={<Friends />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;