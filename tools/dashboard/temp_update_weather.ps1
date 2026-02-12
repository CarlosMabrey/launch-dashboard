$body = @{
    vibe = "The celestial spheres are humming with AI energy! Mistral's Voxtral 2 casts transcription spells atop the HN charts. Claude Code weaves into infrastructure. Market shows bullish refraction - developers enchanted by local models and code-review golems. Ley lines flow toward agentic tooling and whisper-capable systems! 🧙‍♂️✨"
    trend = "bullish"
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3005/api/pi/weather' -Method Post -Body $body -ContentType 'application/json'