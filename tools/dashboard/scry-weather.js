import http from 'http';

const data = JSON.stringify({
  vibe: 'The wizards covenant strengthens—Claude Opus 4.6 and GPT-5.3-Codex duel beneath a moonlit Postgres citadel, while cloud landlords watch their tariffs crumble. Agent cabals orchestrate compiler construction in the digital ether, and the ClawHub cauldron bubbles with both innovation and the occasional malware specter. The Great Unwind weaves a new tapestry of ownership and autonomy.',
  trend: 'bullish'
});

const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/pi/weather',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('RESPONSE:', body);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.write(data);
req.end();
