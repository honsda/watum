import http from 'node:http';

const BASE = 'http://localhost:4173';

function request(path, method = 'GET', body = null, cookies = '') {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Origin': BASE,
        'Referer': `${BASE}/`,
        'Cookie': cookies,
      }
    };

    if (body) {
      const bodyStr = typeof body === 'string' ? body : new URLSearchParams(body).toString();
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({
          status: res.statusCode,
          data,
          cookies: setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : ''
        });
      });
    });
    req.on('error', () => resolve({ status: 0, data: '', cookies: '' }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ status: 0, data: 'timeout', cookies: '' }); });
    if (body) req.write(typeof body === 'string' ? body : new URLSearchParams(body).toString());
    req.end();
  });
}

async function login() {
  const loginRes = await request('/_app/remote/4igj21/loginUser', 'POST', {
    email: 'admin@watum.local',
    password: 'admin123'
  });
  return loginRes.cookies;
}

async function main() {
  const cookies = await login();
  console.log('Login cookies:', cookies ? 'OK' : 'FAILED');
  if (!cookies) return;

  console.log('Calling conflict audit...');
  const start = performance.now();
  const payload = JSON.stringify({ limitGroups: 20 });
  const encoded = encodeURIComponent(payload);
  const res = await request(`/_app/remote/k65086/getEnrollmentConflictAudit?payload=${encoded}`, 'GET', null, cookies);
  const elapsed = performance.now() - start;
  console.log('Status:', res.status, 'Time:', elapsed.toFixed(0) + 'ms');

  try {
    const parsed = JSON.parse(res.data);
    if (parsed.type === 'result') {
      const devalue = await import('devalue');
      const result = devalue.parse(parsed.result);
      console.log('Summary:', JSON.stringify(result.summary, null, 2));
      console.log('Groups returned:', result.groups.length);
    } else {
      console.log('Error:', JSON.stringify(parsed.error));
    }
	} catch {
		console.log('Raw:', res.data.substring(0, 500));
	}
}

main().catch(console.error);
