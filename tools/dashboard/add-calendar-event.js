const http = require('http');

// Get today's date in local time (America/Denver)
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;

const event = {
  event: {
    summary: "Work on dashboard",
    start: {
      dateTime: `${dateStr}T16:00:00`,
      timeZone: "America/Denver"
    },
    end: {
      dateTime: `${dateStr}T22:00:00`,
      timeZone: "America/Denver"
    }
  }
};

const postData = JSON.stringify(event);

const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/pi/calendar/event',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log(`Adding event for ${dateStr} 4pm-10pm to calendar...`);

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`Response status: ${res.statusCode}`);
    console.log('Response body:', data);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();
