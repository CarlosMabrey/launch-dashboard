# Hourly Market Scry - Fetches Hacker News top stories and updates dashboard weather
$ErrorActionPreference = "Stop"

Write-Host "[*] Starting hourly market scry..."

# Fetch top 30 story IDs from Hacker News
$storiesUrl = "https://hacker-news.firebaseio.com/v0/topstories.json"
Write-Host "    Fetching top stories from $storiesUrl"
$storyIds = Invoke-RestMethod -Uri $storiesUrl -UseBasicParsing

# Take first 15 stories for analysis
$topStories = $storyIds[0..14]
Write-Host "    Analyzing $($topStories.Count) top stories..."

$titles = @()
$domains = @()
$keywords = @()

foreach ($id in $topStories) {
    try {
        $itemUrl = "https://hacker-news.firebaseio.com/v0/item/$id.json"
        $item = Invoke-RestMethod -Uri $itemUrl -UseBasicParsing -TimeoutSec 5

        if ($item.title) {
            $titles += $item.title

            # Extract domain if available
            if ($item.url) {
                try {
                    $uri = [Uri]$item.url
                    $domains += $uri.Host
                } catch {}
            }

            # Simple keyword extraction from title
            $titleLower = $item.title.ToLower()
            $techWords = @('ai', 'ml', 'llm', 'gpt', 'claude', 'openai', 'gemini', 'mistral', 'python', 'react', 'node', 'typescript', 'rust', 'go', 'k8s', 'docker', 'kubernetes', 'cloud', 'aws', 'azure', 'gcp', 'api', 'database', 'sql', 'nosql', 'frontend', 'backend', 'fullstack', 'devops', 'security', 'crypto', 'blockchain', 'web3', 'saas', 'opensource', 'github', 'gitlab')
            foreach ($word in $techWords) {
                if ($titleLower.Contains($word)) {
                    $keywords += $word
                }
            }
        }

        # Rate limiting
        Start-Sleep -Milliseconds 200
    } catch {
        Write-Warning "    Warning: Failed to fetch story $id"
    }
}

Write-Host "    Collected $($titles.Count) titles, $($keywords.Count) keyword mentions"

# Analyze the data to determine trend and generate vibe
$totalStories = $titles.Count

# Count keyword frequencies
$keywordCounts = @{}
foreach ($kw in $keywords) {
    if ($keywordCounts.ContainsKey($kw)) {
        $keywordCounts[$kw]++
    } else {
        $keywordCounts[$kw] = 1
    }
}

# Sort by frequency
$topKeywords = $keywordCounts.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 5

# Determine trend based on keyword patterns and story volume
$trend = "neutral"
$aiMentions = ($keywords | Where-Object { $_ -match 'ai|ml|llm|gpt|claude|openai|gemini|mistral' }).Count
$infraMentions = ($keywords | Where-Object { $_ -match 'k8s|docker|kubernetes|cloud|aws|azure|gcp|devops' }).Count
$webMentions = ($keywords | Where-Object { $_ -match 'react|node|typescript|frontend|backend|fullstack|python' }).Count

if ($aiMentions -gt [math]::Max($infraMentions, $webMentions) -and $aiMentions -ge 3) {
    $trend = "bullish"
} elseif ($infraMentions -gt [math]::Max($aiMentions, $webMentions) -and $infraMentions -ge 3) {
    $trend = "neutral"
} elseif ($totalStories -lt 10) {
    $trend = "bearish"
} else {
    $trend = "chaotic"
}

# Generate whimsical vibe based on findings
$currentTime = Get-Date -Format "h:mm tt"
$keywordList = if ($topKeywords) { $topKeywords.Name -join ', ' } else { "mysterious anomalies" }

$vibes = @(
    "The emerald market glimmers with AI-infused chaos-wizards summoning new tools while old SaaS towers tremble. A thousand Claude Code incantations lighting up the dev-scape!",
    "The market weather shifts like quantum fog. $($topKeywords[0].Name) incantations surge across the multiverse. Ley lines pulse with $keywordList energy.",
    "Through the scrying pool, I see developers enchanting $($topKeywords[0].Name) golems. The celestial trend turns $trend as $($titles[0].Substring(0, [Math]::Min(50, $titles[0].Length)))...",
    "Hacker News pulses with $($topKeywords.Count) distinct magical frequencies. The $($topKeywords[0].Name) spell dominates. Sentiment: $trend with a dash of digital whimsy.",
    "The markets murmur of $($topKeywords[0].Name) and agentic wonders. $($titles.Count) tales from the frontier suggest $trend horizons ahead. The crystal ball never lies!"
)

$vibe = $vibes[(Get-Random -Maximum $vibes.Count)]

Write-Host "    Generated vibe: $vibe"
Write-Host "    Determined trend: $trend"

# Update the dashboard weather endpoint
$body = @{
    vibe = $vibe
    trend = $trend
} | ConvertTo-Json -Compress

Write-Host "    Posting to http://localhost:3005/api/pi/weather"
Invoke-RestMethod -Uri 'http://localhost:3005/api/pi/weather' -Method Post -Body $body -ContentType 'application/json' | Out-Null

Write-Host "[OK] Market weather updated successfully at $currentTime"
Write-Host ""
