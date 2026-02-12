const data = JSON.stringify({
  vibe: 'The wizards covenant strengthens—Claude Opus 4.6 and GPT-5.3-Codex duel beneath a moonlit Postgres citadel, while cloud landlords watch their tariffs crumble. Agent cabals orchestrate compiler construction in the digital ether, and the ClawHub cauldron bubbles with both innovation and the occasional malware specter. The Great Unwind weaves a new tapestry of ownership and autonomy.',
  trend: 'bullish'
});

try {
  const response = await fetch('http://localhost:3005/api/pi/weather', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data
  });
  const result = await response.json();
  console.log('STATUS:', response.status);
  console.log('RESPONSE:', JSON.stringify(result, null, 2));
} catch (e) {
  console.error('ERROR:', e.message);
}
