import http from 'http';

const data = JSON.stringify({
  vibe: "The crystal ball shows AI agents multiplying like rabbits in a mana storm. While foundation models plateau, the swarm intelligence of autonomous agents is creating a new economic layer. Venture capital is pivoting from 'build another LLM' to 'orchestrate the swarm' — but beware the resource drain! Local inference hardware demand is surging, and everyone's suddenly an 'agentic engineering' expert. The Great Unwind continues as B2B SaaS gets disintermediated by direct AI-to-AI contracts.",
  trend: "chaotic"
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
  res.setEncoding('utf8');
  let response = '';
  res.on('data', (chunk) => response += chunk);
  res.on('end', () => console.log('Response:', response));
});

req.on('error', (e) => console.error(`Problem with request: ${e.message}`));
req.write(data);
req.end();
