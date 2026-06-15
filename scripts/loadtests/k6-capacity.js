import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.K6_BASE_URL || 'https://avolkovshop.ru/api';
const EMAIL = __ENV.K6_EMAIL || 'loadtest-k6@example.com';
const PASSWORD = __ENV.K6_PASSWORD || 'LoadTest123!';
const VUS = Number(__ENV.K6_VUS || 10);

const errors5xx = new Rate('errors_5xx');

export const options = {
  setupTimeout: '60s',
  scenarios: {
    fixed_load: {
      executor: 'constant-vus',
      vus: VUS,
      duration: '60s',
    },
  },
};

function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

function record(res, name) {
  if (res.status >= 500) errors5xx.add(1);
  else errors5xx.add(0);
  check(res, {
    [`${name} ok`]: (r) => r.status >= 200 && r.status < 500,
  });
  return res;
}

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const token = loginRes.json('access_token');
  const headers = authHeaders(token);
  const accounts = http.get(`${BASE_URL}/budget/accounts`, headers).json();
  let categories = http.get(`${BASE_URL}/budget/categories`, headers).json();
  if (!categories || categories.length === 0) {
    http.post(
      `${BASE_URL}/budget/categories`,
      JSON.stringify({ name: 'Load test category', kind: 'expense' }),
      headers
    );
    categories = http.get(`${BASE_URL}/budget/categories`, headers).json();
  }
  return { token, accountId: accounts[0].id, categoryId: categories[0].id };
}

export default function (data) {
  const headers = authHeaders(data.token);
  const today = new Date().toISOString().slice(0, 10);

  group('app', () => {
    record(http.get(`${BASE_URL}/budget/accounts`, headers), 'accounts');
    record(http.get(`${BASE_URL}/budget/categories`, headers), 'categories');
    record(http.get(`${BASE_URL}/budget/transactions?limit=50`, headers), 'transactions');
    record(http.get(`${BASE_URL}/budget/summary/month`, headers), 'summary_month');
    record(http.get(`${BASE_URL}/budget/summary/charts`, headers), 'summary_charts');
    record(http.get(`${BASE_URL}/budget/obligations`, headers), 'obligations');
    record(http.get(`${BASE_URL}/budget/obligation-blocks`, headers), 'obligation_blocks');
    record(http.get(`${BASE_URL}/whiteboard/list`, headers), 'whiteboard_list');
    record(http.get(`${BASE_URL}/monthly-review`, headers), 'monthly_review');

    const boardPayload = JSON.stringify({
      name: `cap-vu${__VU}-${__ITER}`,
      budget: 50000,
      items: [{
        id: `i-${__VU}-${__ITER}`,
        kind: 'expense',
        title: 'k6',
        amount: 1000,
        x: 80,
        y: 80,
        width: 180,
        height: 100,
        category_id: data.categoryId,
      }],
      zones: [],
    });
    const boardRes = record(http.post(`${BASE_URL}/whiteboard`, boardPayload, headers), 'whiteboard_create');
    if (boardRes.status >= 200 && boardRes.status < 300) {
      const boardId = boardRes.json('id');
      record(http.del(`${BASE_URL}/whiteboard/${boardId}`, null, headers), 'whiteboard_delete');
    }

    const txPayload = JSON.stringify({
      type: 'expense',
      account_id: data.accountId,
      category_id: data.categoryId,
      amount: 10 + (__ITER % 50),
      date: today,
      comment: `cap-${__VU}-${__ITER}`,
    });
    const txRes = record(http.post(`${BASE_URL}/budget/transactions`, txPayload, headers), 'tx_create');
    if (txRes.status >= 200 && txRes.status < 300) {
      record(http.del(`${BASE_URL}/budget/transactions/${txRes.json('id')}`, null, headers), 'tx_delete');
    }
  });

  sleep(0.3);
}

export function handleSummary(data) {
  const p50 = data.metrics.http_req_duration?.values?.['p(50)'] ?? 0;
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] ?? 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] ?? 0;
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;
  const r5xx = data.metrics.errors_5xx?.values?.rate ?? 0;
  const rps = data.metrics.http_reqs?.values?.rate ?? 0;
  return {
    [`/scripts/results/vu${VUS}.json`]: JSON.stringify({
      vus: VUS,
      p50_ms: Math.round(p50),
      p95_ms: Math.round(p95),
      p99_ms: Math.round(p99),
      failed_rate: failed,
      errors_5xx_rate: r5xx,
      rps: Math.round(rps * 10) / 10,
    }),
    stdout: `VU=${VUS} p50=${Math.round(p50)} p95=${Math.round(p95)} p99=${Math.round(p99)} fail=${(failed * 100).toFixed(2)}% 5xx=${(r5xx * 100).toFixed(2)}% rps=${rps.toFixed(1)}\n`,
  };
}
