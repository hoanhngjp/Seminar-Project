import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 50,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<150'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.ACCESS_TOKEN;
const SONG_ID = __ENV.SONG_ID || 'test-song-001';

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/streaming/${SONG_ID}/url`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    timeout: '5s',
  });

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'has url': (r) => {
      try { return JSON.parse(r.body).data?.url !== undefined; }
      catch { return false; }
    },
    'latency < 150ms': (r) => r.timings.duration < 150,
  });

  errorRate.add(!ok);
  sleep(1);
}
