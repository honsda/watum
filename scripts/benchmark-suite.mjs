/**
 * Watum Load Test Suite — JMeter replacement with feature parity.
 *
 * Replicates the JMeter multi-user-test-plan:
 *   - Multi User Scenario: login → refresh → User Operation Flow (transaction)
 *   - Temporary Admin Writes: login → update course → verify read
 *   - CSV user data support
 *   - Ramp-up, loops, think time
 *   - statistics.json + HTML report
 *
 * Usage:
 *   node scripts/benchmark-suite.mjs [options]
 *
 * Options:
 *   --users        CSV file with email,password (default: auto-generate admin token)
 *   --threads      Concurrent users (default: 200)
 *   --ramp-up      Seconds to start all threads (default: 300)
 *   --loops        Iterations per user (default: 3)
 *   --think-time   Ms between iterations (default: 1000)
 *   --duration     Override: run for N seconds instead of loops
 *   --admin        Run admin write thread group too (default: true)
 *   --report       Output dir (default: performance/benchmark-report)
 *   --host         Target host (default: http://localhost:3000)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import * as devalue from 'devalue';

const BASE_URL = process.env.BENCHMARK_HOST || 'http://localhost:3000';

// ─── Configurable defaults ───────────────────────────────────────
const DEFAULT_THREADS = 200;
const DEFAULT_RAMP_UP = 300;
const DEFAULT_LOOPS = 3;
const DEFAULT_THINK_TIME = 1000;
const DEFAULT_WRITE_THREADS = 1;
const DEFAULT_WRITE_RAMP_UP = 30;
const DEFAULT_WRITE_LOOPS = 12;
const DEFAULT_WRITE_THINK_TIME = 2000;

// Admin write cycle course configs (matching JMeter)
const WRITE_CYCLES = [
  {
    courseId: 'stress-course-ti-01',
    baseName: 'Algoritma dan Pemrograman',
    tempName: 'Algoritma dan Pemrograman [Bench]',
    baseCredits: '2',
    tempCredits: '3',
    baseLecturer: 'stress-lec-0001',
    tempLecturer: 'stress-lec-0002',
  },
  {
    courseId: 'stress-course-ti-02',
    baseName: 'Struktur Data',
    tempName: 'Struktur Data [Bench 2]',
    baseCredits: '3',
    tempCredits: '2',
    baseLecturer: 'stress-lec-0002',
    tempLecturer: 'stress-lec-0003',
  },
  {
    courseId: 'stress-course-ti-03',
    baseName: 'Basis Data',
    tempName: 'Basis Data [Bench 3]',
    baseCredits: '3',
    tempCredits: '2',
    baseLecturer: 'stress-lec-0003',
    tempLecturer: 'stress-lec-0004',
  },
];

const ADMIN_CREDENTIALS = { email: 'admin@watum.local', password: 'admin123' };
const STUDY_PROGRAM_ID = 'TI';

// ─── Request client with cookie jar ──────────────────────────────
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
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
        ...extraHeaders,
      };

      // Add cookies
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
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
      }

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          // Store cookies
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            setCookie.forEach((c) => {
              const [kv] = c.split(';');
              const [k, v] = kv.trim().split('=');
              this.cookies.set(k, v);
            });
          }

          let parsed = null;
          try {
            parsed = JSON.parse(data);
            // Unwrap SvelteKit remote function devalue serialization
            if (parsed && parsed.type === 'result' && parsed.result != null) {
              try {
                const devalueInput = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result);
                parsed = devalue.parse(devalueInput);
                // Forms wrap their payload in a { submission, result } envelope
                if (parsed && typeof parsed === 'object' && 'result' in parsed && 'submission' in parsed) {
                  parsed = parsed.result;
                }
              } catch (devalErr) {
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

      req.on('error', () =>
        resolve({ status: 0, time: performance.now() - start, data: null, raw: '' })
      );
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 0, time: performance.now() - start, data: null, raw: '' });
      });
      req.setTimeout(45000);

      if (body) {
        const bodyStr = typeof body === 'string' ? body : new URLSearchParams(body).toString();
        req.write(bodyStr);
      }
      req.end();
    });
  }
}

// ─── Sample collector ────────────────────────────────────────────
class SampleCollector {
  constructor() {
    this.samples = {};
  }

  add(name, status, elapsedMs) {
    if (!this.samples[name]) {
      this.samples[name] = { times: [], errors: 0 };
    }
    if (status === 200) {
      this.samples[name].times.push(elapsedMs);
    } else {
      this.samples[name].errors++;
    }
  }

  stats() {
    const result = {};
    for (const [name, data] of Object.entries(this.samples)) {
      const times = [...data.times].sort((a, b) => a - b);
      if (times.length === 0) {
        result[name] = {
          transaction: name,
          sampleCount: data.errors,
          errorCount: data.errors,
          errorPct: 100.0,
          meanResTime: 0,
          medianResTime: 0,
          minResTime: 0,
          maxResTime: 0,
          pct1ResTime: 0,
          pct2ResTime: 0,
          pct3ResTime: 0,
          throughput: 0,
          receivedKBytesPerSec: 0,
          sentKBytesPerSec: 0,
        };
        continue;
      }
      const sum = times.reduce((a, b) => a + b, 0);
      const totalSamples = times.length + data.errors;
      const durationSec = this.totalDurationSec || 1;
      const p = (p) => times[Math.min(Math.floor(times.length * p), times.length - 1)];
      result[name] = {
        transaction: name,
        sampleCount: totalSamples,
        errorCount: data.errors,
        errorPct: (data.errors / totalSamples) * 100,
        meanResTime: sum / times.length,
        medianResTime: times.length % 2 === 0
          ? (times[Math.floor(times.length / 2) - 1] + times[Math.floor(times.length / 2)]) / 2
          : times[Math.floor(times.length / 2)],
        minResTime: times[0],
        maxResTime: times[times.length - 1],
        pct1ResTime: p(0.90),
        pct2ResTime: p(0.95),
        pct3ResTime: p(0.99),
        throughput: (times.length / durationSec).toFixed(2),
        receivedKBytesPerSec: 0,
        sentKBytesPerSec: 0,
      };
    }
    return result;
  }
}

// ─── User worker ─────────────────────────────────────────────────
async function runUserWorker(user, loops, thinkTimeMs, rampUpDelayMs, collector, abortSignal) {
  await new Promise((r) => setTimeout(r, rampUpDelayMs));

  const client = new HttpClient();

  // ── Login Once ──
  const loginRes = await client.request(
    `${BASE_URL}/_app/remote/4igj21/loginUser`,
    'POST',
    {},
    { email: user.email, password: user.password }
  );
  collector.add('Login User', loginRes.status, loginRes.time);
  if (loginRes.status !== 200) return;

  let token = null;
  if (loginRes.data && typeof loginRes.data === 'object') {
    token = loginRes.data.accessToken ?? null;
  }
  if (!token) return;

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── Loop: refresh + User Operation Flow ──
  for (let i = 0; i < loops && !abortSignal.aborted; i++) {
    // Refresh token (204 = no session to refresh, 200 = new token issued)
    const refreshRes = await client.request(`${BASE_URL}/auth/refresh`, 'POST', authHeaders);
    const refreshOk = refreshRes.status === 200 || refreshRes.status === 204;
    collector.add('Refresh Access Token', refreshOk ? 200 : refreshRes.status, refreshRes.time);
    if (refreshRes.status === 200) {
      if (refreshRes.data && typeof refreshRes.data === 'object' && refreshRes.data.accessToken) {
        token = refreshRes.data.accessToken;
        authHeaders.Authorization = `Bearer ${token}`;
      }
    }

    // ── Transaction: User Operation Flow ──
    const flowStart = performance.now();
    const steps = [
      { name: 'Get Current User', path: '/_app/remote/4igj21/getCurrentUser' },
      { name: 'Get Courses', path: '/_app/remote/1opbo4f/getCourses' },
      { name: 'Get Students', path: '/_app/remote/1t4odyj/getStudents' },
      { name: 'Get Enrollments', path: '/_app/remote/k65086/getEnrollments' },
      { name: 'Get Grades', path: '/_app/remote/1sj3jg7/getGrades' },
    ];

    let flowError = false;
    for (const step of steps) {
      const url = `${BASE_URL}${step.path}?cb=${Math.random().toString(36).slice(2)}`;
      const res = await client.request(url, 'GET', authHeaders);
      collector.add(step.name, res.status, res.time);
      if (res.status !== 200) flowError = true;
    }

    const flowTime = performance.now() - flowStart;
    if (!flowError) {
      collector.add('User Operation Flow', 200, flowTime);
    } else {
      collector.add('User Operation Flow', 500, flowTime);
    }

    if (i < loops - 1 && !abortSignal.aborted) {
      await new Promise((r) => setTimeout(r, thinkTimeMs));
    }
  }
}

// ─── Admin worker ────────────────────────────────────────────────
async function runAdminWorker(loops, thinkTimeMs, rampUpDelayMs, collector, abortSignal) {
  await new Promise((r) => setTimeout(r, rampUpDelayMs));

  const client = new HttpClient();

  // ── Login Admin Once ──
  const loginRes = await client.request(
    `${BASE_URL}/_app/remote/4igj21/loginUser`,
    'POST',
    {},
    { email: ADMIN_CREDENTIALS.email, password: ADMIN_CREDENTIALS.password }
  );
  collector.add('Login Admin User', loginRes.status, loginRes.time);
  if (loginRes.status !== 200) return;

  let token = null;
  if (loginRes.data && typeof loginRes.data === 'object') {
    token = loginRes.data.accessToken ?? null;
  }
  if (!token) return;
  const authHeaders = { Authorization: `Bearer ${token}` };

  for (let i = 0; i < loops && !abortSignal.aborted; i++) {
    for (const cycle of WRITE_CYCLES) {
      // Update to temp value
      const updateRes = await client.request(
        `${BASE_URL}/_app/remote/1opbo4f/updateCourse`,
        'POST',
        authHeaders,
        {
          id: cycle.courseId,
          name: cycle.tempName,
          credits: cycle.tempCredits,
          studyProgramId: STUDY_PROGRAM_ID,
          lecturerId: cycle.tempLecturer,
        }
      );
      collector.add(`Update Course Temp ${cycle.courseId.slice(-2)}`, updateRes.status, updateRes.time);

      // Verify read
      const verifyRes = await client.request(
        `${BASE_URL}/_app/remote/1opbo4f/getCourses?cb=${Math.random().toString(36).slice(2)}`,
        'GET',
        authHeaders
      );
      collector.add(`Get Courses After Temp Update ${cycle.courseId.slice(-2)}`, verifyRes.status, verifyRes.time);

      // Restore base value
      const restoreRes = await client.request(
        `${BASE_URL}/_app/remote/1opbo4f/updateCourse`,
        'POST',
        authHeaders,
        {
          id: cycle.courseId,
          name: cycle.baseName,
          credits: cycle.baseCredits,
          studyProgramId: STUDY_PROGRAM_ID,
          lecturerId: cycle.baseLecturer,
        }
      );
      collector.add(`Restore Course ${cycle.courseId.slice(-2)}`, restoreRes.status, restoreRes.time);
    }

    if (i < loops - 1 && !abortSignal.aborted) {
      await new Promise((r) => setTimeout(r, thinkTimeMs));
    }
  }
}

// ─── Report generation ───────────────────────────────────────────
function generateReport(collector, reportDir) {
  fs.mkdirSync(reportDir, { recursive: true });
  const stats = collector.stats();

  // Write statistics.json (JMeter-compatible format)
  fs.writeFileSync(path.join(reportDir, 'statistics.json'), JSON.stringify(stats, null, 2));

  // Write HTML report
  const rows = Object.values(stats)
    .map((s) => {
      const meanClass = s.meanResTime < 100 ? 'good' : s.meanResTime < 500 ? 'warn' : 'bad';
      return `<tr>
        <td>${s.transaction}</td>
        <td>${s.sampleCount}</td>
        <td>${s.errorCount}</td>
        <td>${s.errorPct.toFixed(1)}%</td>
        <td>${s.throughput}</td>
        <td class="${meanClass}">${s.meanResTime.toFixed(2)}</td>
        <td>${s.medianResTime.toFixed(2)}</td>
        <td>${s.minResTime.toFixed(2)}</td>
        <td>${s.maxResTime.toFixed(2)}</td>
        <td>${s.pct1ResTime.toFixed(2)}</td>
        <td>${s.pct2ResTime.toFixed(2)}</td>
        <td>${s.pct3ResTime.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Watum Benchmark Report</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;margin:2rem;background:#f5f5f5}
h1{color:#333}table{width:100%;border-collapse:collapse;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}
th,td{padding:.75rem 1rem;text-align:right;border-bottom:1px solid #eee}
th{background:#2c3e50;color:#fff}td:first-child,th:first-child{text-align:left}
tr:hover{background:#f8f9fa}.good{color:#27ae60;font-weight:600}
.warn{color:#f39c12;font-weight:600}.bad{color:#e74c3c;font-weight:600}
.summary{background:#fff;padding:1rem;margin-bottom:1rem;border-radius:4px}
</style></head><body>
<h1>Watum Benchmark Report</h1>
<div class="summary">
<p><strong>Host:</strong> ${BASE_URL}</p>
<p><strong>Generated:</strong> ${new Date().toISOString()}</p>
</div>
<table><thead><tr>
<th>Transaction</th><th>Samples</th><th>Errors</th><th>Error %</th>
<th>Throughput</th><th>Mean</th><th>Median</th><th>Min</th><th>Max</th><th>P90</th><th>P95</th><th>P99</th>
</tr></thead><tbody>${rows}</tbody></table>
</body></html>`;

  fs.writeFileSync(path.join(reportDir, 'index.html'), html);
  console.log(`\nReport saved to: ${reportDir}/`);
  console.log(`  - index.html`);
  console.log(`  - statistics.json`);
}

// ─── Args ────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    users: null,
    threads: DEFAULT_THREADS,
    rampUp: DEFAULT_RAMP_UP,
    loops: DEFAULT_LOOPS,
    thinkTime: DEFAULT_THINK_TIME,
    duration: null,
    admin: true,
    report: 'performance/benchmark-report',
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--users':
      case '-u':
        opts.users = args[++i];
        break;
      case '--threads':
      case '-t':
        opts.threads = parseInt(args[++i], 10);
        break;
      case '--ramp-up':
      case '-r':
        opts.rampUp = parseInt(args[++i], 10);
        break;
      case '--loops':
      case '-l':
        opts.loops = parseInt(args[++i], 10);
        break;
      case '--think-time':
        opts.thinkTime = parseInt(args[++i], 10);
        break;
      case '--duration':
      case '-d':
        opts.duration = parseInt(args[++i], 10);
        break;
      case '--no-admin':
        opts.admin = false;
        break;
      case '--report':
        opts.report = args[++i];
        break;
      case '--host':
      case '-h':
        // Handled via BASE_URL env, but could override here
        break;
      case '--help':
        console.log(`Usage: node scripts/benchmark-suite.mjs [options]

Options:
  -u, --users <csv>      CSV file with email,password columns
  -t, --threads <n>      Concurrent users (default: 200)
  -r, --ramp-up <sec>    Seconds to start all threads (default: 300)
  -l, --loops <n>        Iterations per user (default: 3)
      --think-time <ms>  Ms between iterations (default: 1000)
  -d, --duration <sec>   Override: run for N seconds instead of loops
      --no-admin         Skip admin write thread group
      --report <dir>     Output directory (default: performance/benchmark-report)

Examples:
  node scripts/benchmark-suite.mjs --users users.csv -t 200 -r 300 -l 3
  node scripts/benchmark-suite.mjs -t 50 -d 60 --no-admin`);
        process.exit(0);
    }
  }
  return opts;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  // Load users
  let users = [];
  if (opts.users && fs.existsSync(opts.users)) {
    const lines = readFileSync(opts.users, 'utf-8').trim().split('\n');
    const start = lines[0].includes('email') ? 1 : 0;
    for (let i = start; i < lines.length; i++) {
      const [email, password] = lines[i].split(',');
      if (email && password) users.push({ email: email.trim(), password: password.trim() });
    }
  }
  if (users.length === 0) {
    // Fallback: use admin for all threads
    for (let i = 0; i < opts.threads; i++) {
      users.push({ ...ADMIN_CREDENTIALS });
    }
  }
  users = users.slice(0, opts.threads);

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      Watum Load Test Suite (JMeter Replacement)  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Host:        ${BASE_URL}`);
  console.log(`Users:       ${users.length}`);
  console.log(`Ramp-up:     ${opts.rampUp}s`);
  console.log(`Loops:       ${opts.loops}`);
  console.log(`Think time:  ${opts.thinkTime}ms`);
  if (opts.duration) console.log(`Duration:    ${opts.duration}s (overrides loops)`);
  console.log(`Admin writes: ${opts.admin ? 'yes' : 'no'}`);
  console.log('');

  const collector = new SampleCollector();
  const abortController = new AbortController();
  const startTime = performance.now();

  // Duration-based vs loop-based
  const effectiveLoops = opts.duration ? Infinity : opts.loops;
  const maxDurationMs = opts.duration ? opts.duration * 1000 : Infinity;

  // Start user workers with ramp-up
  const workers = [];
  for (let i = 0; i < users.length; i++) {
    const delay = (i / Math.max(users.length - 1, 1)) * opts.rampUp * 1000;
    workers.push(
      runUserWorker(users[i], effectiveLoops, opts.thinkTime, delay, collector, abortController.signal)
    );
  }

  // Start admin worker
  if (opts.admin) {
    workers.push(
      runAdminWorker(
        effectiveLoops,
        DEFAULT_WRITE_THINK_TIME,
        0,
        collector,
        abortController.signal
      )
    );
  }

  // Duration timeout
  if (opts.duration) {
    setTimeout(() => abortController.abort(), opts.duration * 1000 + 5000);
  }

  await Promise.all(workers);

  collector.totalDurationSec = (performance.now() - startTime) / 1000;

  // Print results
  const stats = collector.stats();
  console.log('\n=== Results ===');
  for (const [name, s] of Object.entries(stats)) {
    const status = s.errorCount > 0 ? '⚠' : '✓';
    console.log(
      `${status} ${name.padEnd(35)} samples=${s.sampleCount.toString().padStart(4)} errors=${s.errorCount.toString().padStart(3)} mean=${s.meanResTime.toFixed(1).padStart(7)}ms p95=${s.pct2ResTime.toFixed(1).padStart(7)}ms throughput=${s.throughput}req/s`
    );
  }

  generateReport(collector, opts.report);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
