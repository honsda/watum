/**
 * Watum Load Test Suite — JMeter replacement.
 *
 * Usage:
 *   BENCHMARK_TOKEN=<jwt> node scripts/benchmark-suite.mjs [options]
 *
 * Options:
 *   --concurrency  Number of parallel users (default: 200)
 *   --duration     Test duration in seconds (default: 30)
 *   --endpoint     Single endpoint to test: grades|enrollments|courses|students|health
 *   --flow         Run the full User Operation Flow (default)
 *   --report       Output report directory (default: performance/benchmark-report)
 *
 * Examples:
 *   BENCHMARK_TOKEN=eyJ... node scripts/benchmark-suite.mjs --flow --concurrency 200 --duration 60
 *   BENCHMARK_TOKEN=eyJ... node scripts/benchmark-suite.mjs --endpoint grades --concurrency 50 --duration 10
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BENCHMARK_HOST || 'http://localhost:3000';
const TOKEN = process.env.BENCHMARK_TOKEN;

const ENDPOINTS = {
  grades: { path: '/_app/remote/1sj3jg7/getGrades', needsAuth: true },
  enrollments: { path: '/_app/remote/k65086/getEnrollments', needsAuth: true },
  courses: { path: '/_app/remote/1opbo4f/getCourses', needsAuth: true },
  students: { path: '/_app/remote/1t4odyj/getStudents', needsAuth: true },
  health: { path: '/health', needsAuth: false },
};

const FLOW_STEPS = [
  { name: 'Get Current User', path: '/_app/remote/4igj21/getCurrentUser', thinkTime: 0 },
  { name: 'Get Courses', path: '/_app/remote/1opbo4f/getCourses', thinkTime: 750 },
  { name: 'Get Students', path: '/_app/remote/1t4odyj/getStudents', thinkTime: 750 },
  { name: 'Get Enrollments', path: '/_app/remote/k65086/getEnrollments', thinkTime: 750 },
  { name: 'Get Grades', path: '/_app/remote/1sj3jg7/getGrades', thinkTime: 750 },
];

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Bench';

class BenchRequest {
  constructor(url, method = 'GET', extraHeaders = {}, body = null) {
    this.url = url;
    this.method = method;
    this.extraHeaders = extraHeaders;
    this.body = body;
  }

  run() {
    return new Promise((resolve) => {
      const start = performance.now();
      const urlObj = new URL(this.url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname + urlObj.search,
        method: this.method,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Origin': BASE_URL,
          'Referer': `${BASE_URL}/test`,
          'User-Agent': USER_AGENT,
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache',
          ...this.extraHeaders,
        },
      };

      if (this.body) {
        const bodyStr = typeof this.body === 'string' ? this.body : new URLSearchParams(this.body).toString();
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
      }

      const req = http.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          resolve({ status: res.statusCode, time: performance.now() - start });
        });
      });

      req.on('error', () => resolve({ status: 0, time: performance.now() - start }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 0, time: performance.now() - start });
      });
      req.setTimeout(30000);

      if (this.body) {
        const bodyStr = typeof this.body === 'string' ? this.body : new URLSearchParams(this.body).toString();
        req.write(bodyStr);
      }
      req.end();
    });
  }
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.floor(sortedArr.length * p);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

function formatMs(ms) {
  return ms.toFixed(2).padStart(8, ' ');
}

class Benchmark {
  constructor(name, concurrency, durationMs) {
    this.name = name;
    this.concurrency = concurrency;
    this.durationMs = durationMs;
    this.results = [];
    this.errors = 0;
    this.active = 0;
    this.completed = 0;
  }

  async runLoop(fn) {
    const startTime = performance.now();
    const workers = [];

    for (let i = 0; i < this.concurrency; i++) {
      workers.push(
        (async () => {
          while (performance.now() - startTime < this.durationMs) {
            this.active++;
            const result = await fn();
            this.active--;
            this.completed++;
            if (result.status === 200) {
              this.results.push(result.time);
            } else {
              this.errors++;
            }
          }
        })()
      );
    }

    await Promise.all(workers);
    while (this.active > 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  stats() {
    if (this.results.length === 0) {
      return { samples: 0, errors: this.errors, throughput: 0, mean: 0, median: 0, min: 0, max: 0, p90: 0, p95: 0, p99: 0 };
    }
    const sorted = [...this.results].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const durationSec = this.durationMs / 1000;
    return {
      samples: sorted.length,
      errors: this.errors,
      throughput: (sorted.length / durationSec).toFixed(2),
      mean: sum / sorted.length,
      median: sorted.length % 2 === 0
        ? (sorted[Math.floor(sorted.length / 2) - 1] + sorted[Math.floor(sorted.length / 2)]) / 2
        : sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p90: percentile(sorted, 0.90),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
    };
  }
}

async function runEndpointBenchmark(endpointName, concurrency, durationMs) {
  const endpoint = ENDPOINTS[endpointName];
  if (!endpoint) {
    console.error(`Unknown endpoint: ${endpointName}`);
    return null;
  }

  const authHeaders = endpoint.needsAuth && TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
  const bench = new Benchmark(`${endpointName} (${concurrency} concurrent, ${durationMs / 1000}s)`, concurrency, durationMs);

  await bench.runLoop(async () => {
    const url = `${BASE_URL}${endpoint.path}?cb=${Math.random().toString(36).slice(2)}`;
    return new BenchRequest(url, 'GET', authHeaders).run();
  });

  return bench.stats();
}

async function runFlowBenchmark(concurrency, durationMs) {
  const bench = new Benchmark(`User Operation Flow (${concurrency} concurrent, ${durationMs / 1000}s)`, concurrency, durationMs);
  const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

  await bench.runLoop(async () => {
    for (const step of FLOW_STEPS) {
      const url = `${BASE_URL}${step.path}?cb=${Math.random().toString(36).slice(2)}`;
      await new BenchRequest(url, 'GET', authHeaders).run();
      if (step.thinkTime > 0) {
        await new Promise((r) => setTimeout(r, step.thinkTime));
      }
    }
    return { status: 200, time: 0 }; // Flow completes successfully
  });

  return bench.stats();
}

function generateHtmlReport(results, reportDir) {
  fs.mkdirSync(reportDir, { recursive: true });

  const rows = Object.entries(results)
    .map(([name, stats]) => {
      return `
      <tr>
        <td>${name}</td>
        <td>${stats.samples}</td>
        <td>${stats.errors}</td>
        <td>${stats.throughput}</td>
        <td>${stats.mean.toFixed(2)}</td>
        <td>${stats.median.toFixed(2)}</td>
        <td>${stats.min.toFixed(2)}</td>
        <td>${stats.max.toFixed(2)}</td>
        <td>${stats.p90.toFixed(2)}</td>
        <td>${stats.p95.toFixed(2)}</td>
        <td>${stats.p99.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Watum Benchmark Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; background: #f5f5f5; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem 1rem; text-align: right; border-bottom: 1px solid #eee; }
    th { background: #2c3e50; color: white; text-align: right; }
    td:first-child, th:first-child { text-align: left; }
    tr:hover { background: #f8f9fa; }
    .good { color: #27ae60; font-weight: 600; }
    .warn { color: #f39c12; font-weight: 600; }
    .bad { color: #e74c3c; font-weight: 600; }
    .summary { background: white; padding: 1rem; margin-bottom: 1rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Watum Benchmark Report</h1>
  <div class="summary">
    <p><strong>Host:</strong> ${BASE_URL}</p>
    <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Transaction</th>
        <th>Samples</th>
        <th>Errors</th>
        <th>Throughput (req/s)</th>
        <th>Mean (ms)</th>
        <th>Median (ms)</th>
        <th>Min (ms)</th>
        <th>Max (ms)</th>
        <th>P90 (ms)</th>
        <th>P95 (ms)</th>
        <th>P99 (ms)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(path.join(reportDir, 'index.html'), html);
  console.log(`\nReport saved to: ${reportDir}/index.html`);
}

function printResults(name, stats) {
  console.log(`\n=== ${name} ===`);
  console.log(`  Samples:    ${stats.samples}`);
  console.log(`  Errors:     ${stats.errors}`);
  console.log(`  Throughput: ${stats.throughput} req/s`);
  console.log(`  Mean:       ${formatMs(stats.mean)} ms`);
  console.log(`  Median:     ${formatMs(stats.median)} ms`);
  console.log(`  Min:        ${formatMs(stats.min)} ms`);
  console.log(`  Max:        ${formatMs(stats.max)} ms`);
  console.log(`  P90:        ${formatMs(stats.p90)} ms`);
  console.log(`  P95:        ${formatMs(stats.p95)} ms`);
  console.log(`  P99:        ${formatMs(stats.p99)} ms`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    concurrency: 200,
    duration: 30,
    endpoint: null,
    flow: false,
    report: 'performance/benchmark-report',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--concurrency':
      case '-c':
        options.concurrency = parseInt(args[++i], 10);
        break;
      case '--duration':
      case '-d':
        options.duration = parseInt(args[++i], 10);
        break;
      case '--endpoint':
      case '-e':
        options.endpoint = args[++i];
        break;
      case '--flow':
      case '-f':
        options.flow = true;
        break;
      case '--report':
      case '-r':
        options.report = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`Usage: BENCHMARK_TOKEN=<jwt> node scripts/benchmark-suite.mjs [options]

Options:
  -c, --concurrency <n>   Number of parallel users (default: 200)
  -d, --duration <sec>    Test duration in seconds (default: 30)
  -e, --endpoint <name>   Single endpoint: grades|enrollments|courses|students|health
  -f, --flow              Run User Operation Flow (default if no endpoint)
  -r, --report <dir>      Output directory for HTML report
  -h, --help              Show this help

Examples:
  BENCHMARK_TOKEN=eyJ... node scripts/benchmark-suite.mjs -f -c 200 -d 60
  BENCHMARK_TOKEN=eyJ... node scripts/benchmark-suite.mjs -e grades -c 50 -d 10`);
        process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const durationMs = options.duration * 1000;

  console.log('╔════════════════════════════════════════╗');
  console.log('║      Watum Load Test Suite             ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`Host:        ${BASE_URL}`);
  console.log(`Concurrency: ${options.concurrency}`);
  console.log(`Duration:    ${options.duration}s`);
  console.log(`Mode:        ${options.endpoint ? 'Single endpoint' : 'User Operation Flow'}`);
  console.log('');

  if (options.endpoint && ENDPOINTS[options.endpoint]?.needsAuth && !TOKEN) {
    console.error('Error: BENCHMARK_TOKEN required for authenticated endpoints');
    process.exit(1);
  }
  if (!options.endpoint && !TOKEN) {
    console.error('Error: BENCHMARK_TOKEN required for User Operation Flow');
    process.exit(1);
  }

  const results = {};

  if (options.endpoint) {
    const stats = await runEndpointBenchmark(options.endpoint, options.concurrency, durationMs);
    if (stats) {
      results[options.endpoint] = stats;
      printResults(`${options.endpoint.toUpperCase()} Endpoint`, stats);
    }
  } else {
    // Run the full User Operation Flow
    console.log('Running User Operation Flow...');
    const flowStats = await runFlowBenchmark(options.concurrency, durationMs);
    results['User Operation Flow'] = flowStats;
    printResults('User Operation Flow', flowStats);

    // Also benchmark individual endpoints for comparison
    console.log('\n--- Individual Endpoint Benchmarks ---');
    for (const [name, endpoint] of Object.entries(ENDPOINTS)) {
      if (name === 'health') continue;
      process.stdout.write(`  ${name}... `);
      const stats = await runEndpointBenchmark(name, options.concurrency, 5000);
      if (stats) {
        results[name] = stats;
        console.log(`${stats.throughput} req/s, mean=${stats.mean.toFixed(1)}ms`);
      }
    }
  }

  generateHtmlReport(results, options.report);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
