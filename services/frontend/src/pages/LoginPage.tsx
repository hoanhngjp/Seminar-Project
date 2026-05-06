import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, setAccessToken } from '../api/client';
import { useAuthStore } from '../store/authStore';

type ApiError = { code: string; message: string };
type LoginData = { accessToken: string; expiresIn: number };
type MeData = { id: string; username: string; role: string };

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Tên đăng nhập hoặc mật khẩu không đúng.',
  ACCOUNT_LOCKED: 'Tài khoản tạm thời bị khóa. Thử lại sau 15 phút.',
  RATE_LIMIT_EXCEEDED: 'Quá nhiều lần thử. Vui lòng thử lại sau.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      // Step 1: login → accessToken (+ HTTP-only refresh cookie via withCredentials)
      const loginRes = await apiClient.post<{ success: boolean; data: LoginData; error: ApiError | null }>(
        '/api/v1/auth/login',
        { username, password },
      );

      const { accessToken } = loginRes.data.data;
      // Store in-memory only — never localStorage
      setAccessToken(accessToken);

      // Step 2: fetch profile to get userId + role
      const meRes = await apiClient.get<{ success: boolean; data: MeData; error: ApiError | null }>(
        '/api/v1/users/me',
      );
      const { id, role } = meRes.data.data;
      setAuth(accessToken, id, role);

      // Step 3: redirect by role
      navigate(role === 'Creator' ? '/dashboard' : '/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: ApiError } } };
      const code = axiosErr?.response?.data?.error?.code ?? '';
      setErrorMsg(ERROR_MESSAGES[code] ?? 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Smart Music</h1>
        <p style={styles.subtitle}>Đăng nhập để tiếp tục</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="username">Tên đăng nhập</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            disabled={loading}
            style={styles.input}
            placeholder="email hoặc username"
          />

          <label style={styles.label} htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading}
            style={styles.input}
            placeholder="••••••••"
          />

          {errorMsg && <p style={styles.error}>{errorMsg}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f0f',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#1a1a1a',
    borderRadius: 12,
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  title: {
    margin: '0 0 0.25rem',
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    margin: '0 0 2rem',
    color: '#888',
    textAlign: 'center',
    fontSize: '0.9rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    color: '#aaa',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
  },
  input: {
    padding: '0.65rem 0.85rem',
    borderRadius: 8,
    border: '1px solid #333',
    background: '#111',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.85rem',
    margin: '0.25rem 0',
  },
  button: {
    marginTop: '1.25rem',
    padding: '0.75rem',
    borderRadius: 8,
    border: 'none',
    background: '#1db954',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    opacity: 1,
    transition: 'opacity 0.15s',
  },
};
