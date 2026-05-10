import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 30,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate<0.01'],
  },
};

const QUERIES = ['son tung', 'noi nay co anh', 'chay ngay di', 'hoa no', 'bac phan'];
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.ACCESS_TOKEN;

export default function () {
  const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const res = http.get(
    `${BASE_URL}/api/v1/search?q=${encodeURIComponent(q)}&limit=10`,
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
      timeout: '5s',
    }
  );

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'is array': (r) => {
      try { return Array.isArray(JSON.parse(r.body).data?.items); }
      catch { return false; }
    },
    'latency < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!ok);
  sleep(1);
}
