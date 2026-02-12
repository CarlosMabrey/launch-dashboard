const fs = require('fs');
const path = require('path');

const snippetsPath = 'D:\\Pi\\tools\\dashboard\\apps\\code-preview\\saved\\graphite_snippets.json';

// Read existing snippets
const current = fs.readFileSync(snippetsPath, 'utf8');
const snippets = JSON.parse(current);

// The neon login card HTML
const neonLoginCard = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neon Login</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;500;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            background: #0a0a0f;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Rajdhani', sans-serif;
            overflow: hidden;
            position: relative;
        }
        .grid-bg {
            position: absolute;
            inset: 0;
            background-image:
                linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 50px 50px;
            animation: gridMove 20s linear infinite;
        }
        @keyframes gridMove {
            0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
            100% { transform: perspective(500px) rotateX(60deg) translateY(50px); }
        }
        .orb {
            position: absolute;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.4;
            animation: float 8s ease-in-out infinite;
        }
        .orb-1 { width: 300px; height: 300px; background: #00ffff; top: 10%; left: 20%; animation-delay: 0s; }
        .orb-2 { width: 250px; height: 250px; background: #ff00ff; bottom: 10%; right: 20%; animation-delay: -4s; }
        @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(30px, -30px) scale(1.1); }
        }
        .login-container {
            position: relative;
            width: 420px;
            padding: 50px 40px;
            background: rgba(10, 10, 20, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 255, 255, 0.2);
            border-radius: 24px;
            box-shadow: 0 0 40px rgba(0, 255, 255, 0.1), inset 0 0 20px rgba(0, 0, 0, 0.5);
            z-index: 1;
        }
        .login-container::before {
            content: '';
            position: absolute;
            inset: -2px;
            border-radius: 26px;
            padding: 2px;
            background: linear-gradient(135deg, #00ffff, #ff00ff, #00ffff);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            animation: borderGlow 3s ease-in-out infinite;
        }
        @keyframes borderGlow {
            0%, 100% { opacity: 0.5; } 50% { opacity: 1; }
        }
        .logo { text-align: center; margin-bottom: 40px; }
        .logo h1 {
            font-family: 'Orbitron', sans-serif;
            font-size: 2rem;
            font-weight: 900;
            background: linear-gradient(90deg, #00ffff, #ff00ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: 4px;
            text-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
        }
        .logo p {
            color: rgba(255, 255, 255, 0.5);
            font-size: 0.85rem;
            margin-top: 8px;
            letter-spacing: 2px;
        }
        .form-group { margin-bottom: 24px; position: relative; }
        .form-group label {
            display: block;
            color: #00ffff;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 8px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
        }
        .form-group input[type="text"], .form-group input[type="password"] {
            width: 100%;
            padding: 14px 16px;
            background: rgba(0, 0, 0, 0.6);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 12px;
            color: #fff;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1rem;
            outline: none;
            transition: all 0.3s ease;
        }
        .form-group input:focus {
            border-color: #00ffff;
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 10px rgba(0, 255, 255, 0.1);
        }
        .form-group input::placeholder { color: rgba(255, 255, 255, 0.3); }
        .form-options {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
            font-size: 0.85rem;
        }
        .remember-me {
            display: flex;
            align-items: center;
            gap: 8px;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
        }
        .remember-me input[type="checkbox"] {
            appearance: none;
            width: 18px; height: 18px;
            border: 1px solid rgba(0, 255, 255, 0.5);
            border-radius: 4px;
            cursor: pointer;
            position: relative;
            transition: all 0.2s;
        }
        .remember-me input:checked { background: #00ffff; box-shadow: 0 0 10px #00ffff; }
        .remember-me input:checked::after {
            content: '✓';
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            color: #000; font-size: 12px; font-weight: bold;
        }
        .forgot-password { color: #ff00ff; text-decoration: none; transition: all 0.2s; }
        .forgot-password:hover { text-shadow: 0 0 15px #ff00ff; }
        .submit-btn {
            width: 100%;
            padding: 16px;
            background: transparent;
            border: 2px solid #00ffff;
            border-radius: 14px;
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            font-size: 1rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 3px;
            cursor: pointer;
            position: relative;
            overflow: hidden;
            transition: all 0.3s ease;
        }
        .submit-btn::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.2), transparent);
            transform: translateX(-100%);
            transition: transform 0.5s ease;
        }
        .submit-btn:hover {
            background: rgba(0, 255, 255, 0.1);
            box-shadow: 0 0 30px rgba(0, 255, 255, 0.4), inset 0 0 20px rgba(0, 255, 255, 0.1);
            text-shadow: 0 0 15px #00ffff;
        }
        .submit-btn:hover::before { transform: translateX(100%); }
        .submit-btn:active { transform: scale(0.98); }
        .login-footer { margin-top: 30px; text-align: center; font-size: 0.8rem; color: rgba(255, 255, 255, 0.4); }
        .login-footer a { color: #ff00ff; text-decoration: none; }
        .scanlines {
            position: absolute;
            inset: 0;
            background: repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 3px);
            pointer-events: none; z-index: 2; opacity: 0.3;
        }
    </style>
</head>
<body>
    <div class="grid-bg"></div>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="scanlines"></div>
    <div class="login-container">
        <div class="logo">
            <h1>NEONACCESS</h1>
            <p>SECURE ENTRY PROTOCOL</p>
        </div>
        <form>
            <div class="form-group">
                <label for="username">Agent ID (Username)</label>
                <input type="text" id="username" placeholder="Enter your agent ID..." autocomplete="off">
            </div>
            <div class="form-group">
                <label for="password">Access Code (Password)</label>
                <input type="password" id="password" placeholder="Enter your access code...">
            </div>
            <div class="form-options">
                <label class="remember-me">
                    <input type="checkbox"><span>Remember Identity</span>
                </label>
                <a href="#" class="forgot-password">Lost Access?</a>
            </div>
            <button type="submit" class="submit-btn">Initialize Link</button>
        </form>
        <div class="login-footer">
           <p>Unauthorized access is a<span style="color: #ff00ff;">felony</span>. All activities are monitored.</p>
           <p style="margin-top: 8px;">New agent? <a href="#">Request Induction</a></p>
        </div>
    </div>
    <script>
        const container = document.querySelector('.login-container');
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                container.style.boxShadow = '0 0 60px rgba(0, 255, 255, 0.2), inset 0 0 30px rgba(0, 255, 255, 0.05)';
            });
            input.addEventListener('blur', () => {
                container.style.boxShadow = '0 0 40px rgba(0, 255, 255, 0.1), inset 0 0 20px rgba(0, 0, 0, 0.5)';
            });
        });
        const submitBtn = document.querySelector('.submit-btn');
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const btn = e.target;
            btn.innerHTML = 'AUTHENTICATING...';
            btn.style.background = 'rgba(0, 255, 255, 0.2)';
            setTimeout(() => {
                btn.innerHTML = 'ACCESS GRANTED';
                btn.style.background = 'rgba(0, 255, 255, 0.4)';
                btn.style.borderColor = '#00ff00';
                btn.style.color = '#00ff00';
                setTimeout(() => {
                    btn.innerHTML = 'INITIALIZE LINK';
                    btn.style.background = '';
                    btn.style.borderColor = '';
                    btn.style.color = '';
                }, 2000);
            }, 1500);
        });
    </script>
</body>
</html>`;

const newSnippet = {
    id: 'neon-login-' + Date.now(),
    name: 'Neon Login Card - Cyberpunk',
    html: neonLoginCard,
    css: '',
    js: '',
    timestamp: new Date().toLocaleString()
};

// Add to array
snippets.push(newSnippet);

// Write back
fs.writeFileSync(snippetsPath, JSON.stringify(snippets, null, 2));

console.log(`✅ Saved Neon Login Card snippet (id: ${newSnippet.id})`);
console.log(`📊 Total snippets now: ${snippets.length}`);
