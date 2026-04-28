const http = require('http');

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbi1kZWZhdWx0IiwicHdkdiI6InpHWEtXUTVLRGRwMUItNXdBVnVKbjYxblNlVndLaFpjeURfeFlIRlJPT3MiLCJjdHgiOiJ0ZXN0IiwiaWF0IjoxNzc3MDk1NTkzLCJleHAiOjE3NzcwOTU4OTN9.GArNkJ__9_sXmcnIq8QSQw-9kUgeS83JwzYII4Mhe_Q";

function request() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get('http://localhost:3000/_app/remote/1sj3jg7/getGrades?cb=' + Math.random(), {
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Origin': 'http://localhost:3000',
        'Referer': 'http://localhost:3000/test',
        'Accept': 'application/json'
      }
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(Date.now() - start));
    });
    req.on('error', () => resolve(99999));
  });
}

async function run() {
  const times = [];
  // Sequential: 5 requests like User Operation Flow
  for (let i = 0; i < 5; i++) {
    const t = await request();
    times.push(t);
    await new Promise(r => setTimeout(r, 1000)); // think time
  }
  console.log('Sequential (like User Op Flow):', times, 'Total:', times.reduce((a,b)=>a+b,0));

  // Concurrent: 200 at once
  const start = Date.now();
  const promises = Array(200).fill().map(request);
  const results = await Promise.all(promises);
  const total = Date.now() - start;
  results.sort((a,b) => a-b);
  console.log('Concurrent 200: Mean:', results.reduce((a,b)=>a+b,0)/200, 'P95:', results[190], 'All done in:', total);
}

run();
