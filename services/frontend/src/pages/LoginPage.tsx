import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, setAccessToken } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { colors, font, fontSize, fontWeight, radius, shadows, spacing } from '../styles/tokens';

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
    background: colors.bg,
    fontFamily: font.family,
  },
  card: {
    background: colors.surface,
    borderRadius: radius.card,
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 400,
    boxShadow: shadows.heavy,
  },
  title: {
    margin: '0 0 0.25rem',
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
    color: colors.accent,
    fontFamily: font.title,
    textAlign: 'center',
  },
  subtitle: {
    margin: '0 0 2rem',
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: fontSize.caption,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing[2]}px`,
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: `${spacing[2]}px`,
  },
  input: {
    padding: '12px 24px',
    borderRadius: radius.pill,
    border: 'none',
    boxShadow: shadows.inset,
    background: colors.surfaceMid,
    color: colors.text,
    fontSize: fontSize.body,
    outline: 'none',
  },
  error: {
    color: colors.error,
    fontSize: fontSize.caption,
    margin: `${spacing[1]}px 0`,
  },
  button: {
    marginTop: `${spacing[5]}px`,
    padding: '12px',
    borderRadius: radius.fullPill,
    border: 'none',
    background: colors.accent,
    color: '#000000',
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: '1.4px',
    cursor: 'pointer',
    opacity: 1,
    transition: 'opacity 0.15s',
  },
};
