/**
 * Node.js benchmark for Watum app.
 * Measures concurrent request performance against the local server.
 *
 * Usage:
 *   BENCHMARK_TOKEN=<jwt> node scripts/benchmark-node.mjs [endpoint] [concurrency] [durationSeconds]
 *
 * Examples:
 *   BENCHMARK_TOKEN=eyJ... node scripts/benchmark-node.mjs grades 200 30
 *   node scripts/benchmark-node.mjs health 50 10
 */

import http from 'node:http';

const BASE_URL = process.env.BENCHMARK_HOST || 'http://localhost:3000';
const TOKEN = process.env.BENCHMARK_TOKEN;

const ENDPOINTS = {
  grades: '/_app/remote/1sj3jg7/getGrades',
  enrollments: '/_app/remote/k65086/getEnrollments',
  courses: '/_app/remote/1opbo4f/getCourses',
  students: '/_app/remote/1t4odyj/getStudents',
  health: '/health',
};

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Bench';

function request(url, method = 'GET', headers = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/test`,
        'User-Agent': USER_AGENT,
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        resolve({ status: res.statusCode, time: performance.now() - start });
      });
    });

    req.on('error', (err) => {
      console.error('Request error:', err.message);
      resolve({ status: 0, time: performance.now() - start });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, time: performance.now() - start });
    });
    req.setTimeout(30000);
    req.end();
  });
}

async function benchmarkEndpoint(endpoint, token, concurrency, durationMs) {
  const url = `${BASE_URL}${endpoint}?cb=${Math.random().toString(36).slice(2)}`;
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

  const times = [];
  const errors = [];
  let active = 0;
  const startTime = performance.now();

  function runRequest() {
    if (performance.now() - startTime > durationMs) return;

    active++;
    request(url, 'GET', headers).then((result) => {
      active--;
      if (result.status === 200) {
        times.push(result.time);
      } else {
        errors.push({ status: result.status, time: result.time });
      }

      if (performance.now() - startTime < durationMs) {
        runRequest();
      }
    });
  }

  // Start initial batch
  for (let i = 0; i < concurrency; i++) {
    runRequest();
  }

  // Wait for duration
  await new Promise(r => setTimeout(r, durationMs + 500));

  // Wait for remaining requests
  while (active > 0) {
    await new Promise(r => setTimeout(r, 100));
  }

  return { times, errors, duration: performance.now() - startTime };
}

function formatStats(label, times, durationMs, errors) {
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
  const p90 = times[Math.floor(times.length * 0.90)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const min = times[0];
  const max = times[times.length - 1];
  const throughput = (times.length / (durationMs / 1000)).toFixed(2);

  console.log(`\n=== ${label} ===`);
  console.log(`  Samples:    ${times.length}`);
  console.log(`  Errors:     ${errors.length}`);
  console.log(`  Throughput: ${throughput} req/s`);
  console.log(`  Mean:       ${mean.toFixed(2)}ms`);
  console.log(`  Median:     ${median.toFixed(2)}ms`);
  console.log(`  Min:        ${min.toFixed(2)}ms`);
  console.log(`  Max:        ${max.toFixed(2)}ms`);
  console.log(`  P90:        ${p90.toFixed(2)}ms`);
  console.log(`  P95:        ${p95.toFixed(2)}ms`);
  console.log(`  P99:        ${p99.toFixed(2)}ms`);
}

async function main() {
  const endpointName = process.argv[2] || 'grades';
  const concurrency = parseInt(process.argv[3], 10) || 200;
  const durationSeconds = parseInt(process.argv[4], 10) || 30;
  const durationMs = durationSeconds * 1000;

  const endpoint = ENDPOINTS[endpointName];
  if (!endpoint) {
    console.error(`Unknown endpoint: ${endpointName}`);
    console.error(`Available: ${Object.keys(ENDPOINTS).join(', ')}`);
    process.exit(1);
  }

  console.log(`Benchmark: ${endpointName}`);
  console.log(`URL: ${BASE_URL}${endpoint}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Duration: ${durationSeconds}s`);

  if (endpointName !== 'health' && !TOKEN) {
    console.error('\nError: BENCHMARK_TOKEN env var required for authenticated endpoints');
    console.error('Generate a token from the browser or set it in the environment');
    process.exit(1);
  }

  console.log('\nRunning benchmark...\n');
  const result = await benchmarkEndpoint(endpoint, TOKEN, concurrency, durationMs);

  formatStats(
    `${endpointName.toUpperCase()} (${concurrency} concurrent, ${durationSeconds}s)`,
    result.times, result.duration, result.errors
  );

  if (result.errors.length > 0) {
    console.log(`\nError breakdown:`);
    const statusCounts = {};
    result.errors.forEach(e => {
      statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    });
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  Status ${status}: ${count}`);
    });
  }
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
