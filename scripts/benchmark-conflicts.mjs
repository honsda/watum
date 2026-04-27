/**
 * Conflict Detection Speed Benchmark
 *
 * Tests the getEnrollmentConflictAudit endpoint under various conditions:
 *   - Cold cache (first request, no cached result)
 *   - Warm cache (repeated request within TTL)
 *   - Different conflict types: all, room, student, lecturer
 *   - Concurrent requests
 *
 * Usage:
 *   BENCHMARK_HOST=http://localhost:4173 node scripts/benchmark-conflicts.mjs [concurrency] [durationSeconds]
 */

import http from 'node:http';
import * as devalue from 'devalue';

const BASE_URL = process.env.BENCHMARK_HOST || 'http://localhost:4173';
const CONCURRENCY = parseInt(process.argv[2], 10) || 1;
const DURATION_SEC = parseInt(process.argv[3], 10) || 30;

// Conflict audit endpoint
const CONFLICT_ENDPOINT = '/_app/remote/k65086/getEnrollmentConflictAudit';

// Test scenarios
const SCENARIOS = [
  { name: 'All Conflicts', body: {} },
  { name: 'Room Conflicts', body: { conflictType: 'room' } },
  { name: 'Student Conflicts', body: { conflictType: 'student' } },
  { name: 'Lecturer Conflicts', body: { conflictType: 'lecturer' } },
  { name: 'Filtered (2023/Ganjil)', body: { academicYear: '2023/2024', semester: 'Ganjil' } },
];

class HttpClient {
  constructor() {
    this.cookies = new Map();
  }

  request(url, method = 'GET', extraHeaders = {}, body = null) {
    return new Promise((resolve) => {
      const start = performance.now();
      const urlObj = new URL(url);
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/test`,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36 Bench',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
        ...extraHeaders,
      };

      const cookieStr = Array.from(this.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      if (cookieStr) headers['Cookie'] = cookieStr;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
      };

      if (body) {
        const bodyStr = typeof body === 'string' ? body : new URLSearchParams(body).toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = Buffer.byteLength(bodyStr);
      }

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            setCookie.forEach((c) => {
              const [kv] = c.split(';');
              const [k, v] = kv.trim().split('=');
              this.cookies.set(k, v);
            });
          }

			let parsed;
			try {
				parsed = JSON.parse(data);
				if (parsed && parsed.type === 'result' && parsed.result != null) {
					try {
						const devalueInput = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result);
						parsed = devalue.parse(devalueInput);
						if (parsed && typeof parsed === 'object' && 'result' in parsed && 'submission' in parsed) {
							parsed = parsed.result;
						}
					} catch {
						// leave as-is if devalue parsing fails
					}
				}
			} catch {
				parsed = data;
			}

          resolve({
            status: res.statusCode,
            time: performance.now() - start,
            data: parsed,
            raw: data,
          });
        });
      });

      req.on('error', () => resolve({ status: 0, time: performance.now() - start, data: null, raw: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, time: performance.now() - start, data: null, raw: '' }); });
      req.setTimeout(45000);

      if (body) {
        const bodyStr = typeof body === 'string' ? body : new URLSearchParams(body).toString();
        req.write(bodyStr);
      }
      req.end();
    });
  }
}

async function login(client) {
  const res = await client.request(
    `${BASE_URL}/_app/remote/4igj21/loginUser`,
    'POST',
    {},
    { email: 'admin@watum.local', password: 'admin123' }
  );
  if (res.status !== 200) {
    console.error('Login failed:', res.status, res.data);
    throw new Error('Login failed');
  }
  return res.data?.accessToken ?? null;
}

async function runConflictAudit(client, token, scenario, invalidateCache = false) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (invalidateCache) {
    headers['Cache-Control'] = 'no-cache';
  }
  const body = { ...scenario.body };
  if (invalidateCache) {
    body._cb = Math.random().toString(36).slice(2);
  }
  const bodyStr = new URLSearchParams(body).toString();
  const res = await client.request(`${BASE_URL}${CONFLICT_ENDPOINT}`, 'POST', headers, bodyStr);
  return res;
}

function formatStats(label, times, errors) {
  if (times.length === 0) {
    console.log(`${label}: No successful requests (${errors.length} errors)`);
    return;
  }
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const mean = sum / times.length;
  const median = times.length % 2 === 0
    ? (times[Math.floor(times.length / 2) - 1] + times[Math.floor(times.length / 2)]) / 2
    : times[Math.floor(times.length / 2)];
	const p95 = times[Math.floor(times.length * 0.95)];
	const p99 = times[Math.floor(times.length * 0.99)];

  console.log(`  ${label.padEnd(30)} n=${times.length.toString().padStart(4)} err=${errors.length.toString().padStart(2)} mean=${mean.toFixed(1).padStart(7)}ms med=${median.toFixed(1).padStart(7)}ms p95=${p95.toFixed(1).padStart(7)}ms p99=${p99.toFixed(1).padStart(7)}ms`);
}

async function benchmarkScenario(scenario, concurrency, durationMs) {
  const client = new HttpClient();
  const token = await login(client);

  // First: cold cache test (single request, no cache)
  console.log(`\n--- ${scenario.name} ---`);
  const coldRes = await runConflictAudit(client, token, scenario, true);
  console.log(`  Cold cache:  ${coldRes.status === 200 ? 'OK' : 'FAIL'} ${coldRes.time.toFixed(1)}ms`);
  if (coldRes.status === 200 && coldRes.data?.summary) {
    const s = coldRes.data.summary;
    console.log(`    Groups: total=${s.totalGroups} room=${s.roomGroups} student=${s.studentGroups} lecturer=${s.lecturerGroups} enrollments=${s.conflictedEnrollments}`);
  }

  // Warm cache test (single request, should hit cache)
  const warmRes = await runConflictAudit(client, token, scenario, false);
  console.log(`  Warm cache:  ${warmRes.status === 200 ? 'OK' : 'FAIL'} ${warmRes.time.toFixed(1)}ms`);

  // Concurrent stress test
  const times = [];
  const errors = [];
  let active = 0;
  const startTime = performance.now();

  function runRequest() {
    if (performance.now() - startTime > durationMs) return;
    active++;
    runConflictAudit(client, token, scenario, false).then((res) => {
      active--;
      if (res.status === 200) times.push(res.time);
      else errors.push({ status: res.status, time: res.time });
      if (performance.now() - startTime < durationMs) runRequest();
    });
  }

  for (let i = 0; i < concurrency; i++) runRequest();

  await new Promise(r => setTimeout(r, durationMs + 500));
  while (active > 0) await new Promise(r => setTimeout(r, 100));

  formatStats(`${scenario.name} (${concurrency}c)`, times, errors);
  if (errors.length > 0) {
    const statusCounts = {};
    errors.forEach(e => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`    Error status ${status}: ${count}`);
    });
  }

  return { times, errors };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      Conflict Detection Speed Benchmark          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Host:        ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Duration:    ${DURATION_SEC}s per scenario`);
  console.log('');

  const durationMs = DURATION_SEC * 1000;
  const allResults = {};

  for (const scenario of SCENARIOS) {
    const result = await benchmarkScenario(scenario, CONCURRENCY, durationMs);
    allResults[scenario.name] = result;
  }

  console.log('\n=== Summary ===');
  for (const [name, result] of Object.entries(allResults)) {
    if (result.times.length > 0) {
      const mean = result.times.reduce((a, b) => a + b, 0) / result.times.length;
      const p95 = result.times.sort((a, b) => a - b)[Math.floor(result.times.length * 0.95)];
      console.log(`${name.padEnd(25)} mean=${mean.toFixed(1).padStart(7)}ms p95=${p95.toFixed(1).padStart(7)}ms errors=${result.errors.length}`);
    }
  }
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
