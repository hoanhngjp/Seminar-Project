import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 30,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    errors: ['rate<0.01'],
  },
};

const CONTEXTS = ['morning', 'evening', 'none'];
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.ACCESS_TOKEN;

export default function () {
  const ctx = CONTEXTS[Math.floor(Math.random() * CONTEXTS.length)];
  const res = http.get(
    `${BASE_URL}/api/v1/recommendations?context=${ctx}&limit=20`,
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
      timeout: '5s',
    }
  );

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'has items': (r) => {
      try { return JSON.parse(r.body).data?.items?.length > 0; }
      catch { return false; }
    },
    'latency < 300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(!ok);
  sleep(1);
}
