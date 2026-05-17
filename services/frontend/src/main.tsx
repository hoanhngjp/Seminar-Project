import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

async function prepare() {
  if (import.meta.env.VITE_MOCK === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass', // pass through unknown requests instead of warning
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
    console.info('[MSW] Mock mode active — all API calls intercepted');
  }
}

prepare().then(() => {
  // StrictMode removed: double-invocation causes SignalR cleanup to trigger OnDisconnectedAsync,
  // deleting the room from Redis before the second mount can reconnect.
  createRoot(document.getElementById('root')!).render(<App />);
});
