import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.K6_BASE_URL || 'https://avolkovshop.ru/api';
const EMAIL = __ENV.K6_EMAIL || 'loadtest-k6@example.com';
const PASSWORD = __ENV.K6_PASSWORD || 'LoadTest123!';

const errorRate = new Rate('app_errors');
const tabDuration = new Trend('tab_action_duration', true);

export const options = {
  setupTimeout: '60s',
  scenarios: {
    ramp_active_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 3 },
        { duration: '30s', target: 3 },
        { duration: '20s', target: 5 },
        { duration: '30s', target: 5 },
        { duration: '20s', target: 8 },
        { duration: '30s', target: 8 },
        { duration: '20s', target: 10 },
        { duration: '30s', target: 10 },
        { duration: '20s', target: 15 },
        { duration: '30s', target: 15 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    app_errors: ['rate<0.10'],
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
  tabDuration.add(res.timings.duration, { name });
  const ok = check(res, {
    [`${name} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  if (!ok) errorRate.add(1);
  else errorRate.add(0);
  return res;
}

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.body}`);
  }

  const token = loginRes.json('access_token');
  const headers = authHeaders(token);

  let accounts = http.get(`${BASE_URL}/budget/accounts`, headers).json();
  if (!accounts || accounts.length === 0) {
    http.post(
      `${BASE_URL}/budget/accounts`,
      JSON.stringify({ title: 'Load test account', currency: 'RUB', is_savings: false }),
      headers
    );
    accounts = http.get(`${BASE_URL}/budget/accounts`, headers).json();
  }

  let categories = http.get(`${BASE_URL}/budget/categories`, headers).json();
  if (!categories || categories.length === 0) {
    http.post(
      `${BASE_URL}/budget/categories`,
      JSON.stringify({ name: 'Load test category', kind: 'expense' }),
      headers
    );
    categories = http.get(`${BASE_URL}/budget/categories`, headers).json();
  }

  return {
    token,
    accountId: accounts[0].id,
    categoryId: categories[0].id,
  };
}

export default function (data) {
  const headers = authHeaders(data.token);
  const today = new Date().toISOString().slice(0, 10);

  group('dashboard_and_budget', () => {
    record(http.get(`${BASE_URL}/health/ping`), 'health');
    record(http.get(`${BASE_URL}/budget/accounts`, headers), 'accounts');
    record(http.get(`${BASE_URL}/budget/categories`, headers), 'categories');
    record(http.get(`${BASE_URL}/budget/transactions?limit=50`, headers), 'transactions');
    record(http.get(`${BASE_URL}/budget/summary/month`, headers), 'summary_month');
    record(http.get(`${BASE_URL}/budget/summary/charts`, headers), 'summary_charts');
    record(http.get(`${BASE_URL}/budget/obligations`, headers), 'obligations');
    record(http.get(`${BASE_URL}/budget/obligation-blocks`, headers), 'obligation_blocks');
  });

  group('whiteboard', () => {
    record(http.get(`${BASE_URL}/whiteboard/list`, headers), 'whiteboard_list');
    record(http.get(`${BASE_URL}/whiteboard/latest`, headers), 'whiteboard_latest');

    const boardPayload = JSON.stringify({
      name: `k6-board-vu${__VU}-iter${__ITER}`,
      budget: 100000,
      items: [
        {
          id: `item-${__VU}-${__ITER}`,
          kind: 'expense',
          title: 'Тест k6',
          amount: 1500,
          x: 100,
          y: 100,
          width: 200,
          height: 120,
          category_id: data.categoryId,
        },
      ],
      zones: [],
    });
    const createRes = record(
      http.post(`${BASE_URL}/whiteboard`, boardPayload, headers),
      'whiteboard_create'
    );
    if (createRes.status === 200 || createRes.status === 201) {
      const boardId = createRes.json('id');
      record(http.get(`${BASE_URL}/whiteboard/${boardId}`, headers), 'whiteboard_get');
      record(http.del(`${BASE_URL}/whiteboard/${boardId}`, null, headers), 'whiteboard_delete');
    }
  });

  group('writes', () => {
    const txPayload = JSON.stringify({
      type: 'expense',
      account_id: data.accountId,
      category_id: data.categoryId,
      amount: 10 + (__ITER % 100),
      date: today,
      comment: `k6 vu${__VU} iter${__ITER}`,
    });
    const txRes = record(
      http.post(`${BASE_URL}/budget/transactions`, txPayload, headers),
      'transaction_create'
    );
    if (txRes.status === 200 || txRes.status === 201) {
      const txId = txRes.json('id');
      record(http.del(`${BASE_URL}/budget/transactions/${txId}`, null, headers), 'transaction_delete');
    }
  });

  group('monthly_review', () => {
    record(http.get(`${BASE_URL}/monthly-review`, headers), 'monthly_review');
  });

  sleep(0.5);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] ?? 0;
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;
  const maxVUs = data.metrics.vus_max?.values?.max ?? 0;
  return {
    stdout: [
      '',
      '=== BIGS load test summary ===',
      `Max VUs: ${maxVUs}`,
      `HTTP p95: ${p95.toFixed(0)} ms`,
      `Failed rate: ${(failed * 100).toFixed(2)}%`,
      '',
    ].join('\n'),
  };
}
