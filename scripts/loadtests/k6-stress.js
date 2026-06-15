import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.K6_BASE_URL || 'https://avolkovshop.ru/api';
const EMAIL = __ENV.K6_EMAIL || 'loadtest-k6@example.com';
const PASSWORD = __ENV.K6_PASSWORD || 'LoadTest123!';

export const options = {
  setupTimeout: '60s',
  scenarios: {
    find_breaking_point: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 15 },
        { duration: '30s', target: 20 },
        { duration: '30s', target: 25 },
        { duration: '30s', target: 30 },
        { duration: '30s', target: 35 },
        { duration: '20s', target: 0 },
      ],
    },
  },
};

function headers(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const token = res.json('access_token');
  const h = headers(token);
  const accounts = http.get(`${BASE_URL}/budget/accounts`, h).json();
  const categories = http.get(`${BASE_URL}/budget/categories`, h).json();
  return { token, accountId: accounts[0].id, categoryId: categories[0].id };
}

export default function (data) {
  const h = headers(data.token);
  const today = new Date().toISOString().slice(0, 10);
  const reqs = [
    ['GET', `${BASE_URL}/budget/summary/month`, null],
    ['GET', `${BASE_URL}/budget/transactions?limit=50`, null],
    ['POST', `${BASE_URL}/budget/transactions`, JSON.stringify({
      type: 'expense', account_id: data.accountId, category_id: data.categoryId,
      amount: 50, date: today, comment: `stress-${__VU}-${__ITER}`,
    })],
    ['GET', `${BASE_URL}/whiteboard/list`, null],
    ['POST', `${BASE_URL}/whiteboard`, JSON.stringify({
      name: `stress-${__VU}-${__ITER}`, budget: 50000, items: [], zones: [],
    })],
  ];
  for (const [method, url, body] of reqs) {
    const res = method === 'GET' ? http.get(url, h) : http.post(url, body, h);
    check(res, { ok: (r) => r.status < 500 });
    if ((method === 'POST') && (res.status === 200 || res.status === 201)) {
      const id = res.json('id');
      if (url.includes('transactions')) {
        http.del(`${BASE_URL}/budget/transactions/${id}`, null, h);
      } else {
        http.del(`${BASE_URL}/whiteboard/${id}`, null, h);
      }
    }
  }
  sleep(0.2);
}
