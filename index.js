<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeGoldenAI • Build Smarter Websites</title>
  <style>
    :root {
      --bg: #0a0f1c;
      --card: #141b2d;
      --text: #eaf1ff;
      --muted: #b8c3dc;
      --gold1: #f6c64a;
      --gold2: #eb8b36;
      --radius: 18px;
      --shadow: 0 20px 60px rgba(0,0,0,.55);
      --max: 1100px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      background: radial-gradient(1200px 800px at 75% -20%, rgba(246,198,74,.15), transparent 40%),
                  radial-gradient(900px 700px at 10% 120%, rgba(235,139,54,.15), transparent 40%),
                  var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 1.2rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: var(--max);
      margin: 0 auto;
      width: 100%;
    }
    header h1 {
      font-size: 1.6rem;
      background: linear-gradient(45deg, var(--gold1), var(--gold2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    nav a {
      margin-left: 1.5rem;
      text-decoration: none;
      color: var(--muted);
      font-weight: 500;
      transition: color .2s;
    }
    nav a:hover { color: var(--gold1); }
    .hero {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 3rem 1.5rem;
    }
    .hero h2 {
      font-size: 2.5rem;
      max-width: 700px;
      margin-bottom: 1rem;
      background: linear-gradient(45deg, var(--gold1), var(--gold2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero p {
      max-width: 600px;
      margin-bottom: 2rem;
      color: var(--muted);
      font-size: 1.1rem;
    }
    .buttons {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .btn {
      background: var(--card);
      border: 2px solid var(--gold1);
      padding: 0.9rem 1.6rem;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      font-size: 1rem;
      font-weight: bold;
      color: var(--text);
      cursor: pointer;
      transition: transform .2s, background .2s;
    }
    .btn:hover {
      transform: translateY(-4px);
      background: rgba(246,198,74,.1);
    }
    footer {
      text-align: center;
      padding: 1rem;
      color: var(--muted);
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>CodeGoldenAI</h1>
    <nav>
      <a href="/plans.html">Plans</a>
      <a href="/playground.html">AI Playground</a>
      <a href="/engineer.html">Hire Engineer</a>
    </nav>
  </header>

  <main class="hero">
    <h2>Build Smarter Websites with AI + Code Engineers</h2>
    <p>Generate professional websites using advanced AI code creator, or work directly with a Code Engineer to bring your ideas to life. Affordable plans, powerful results.</p>
    <div class="buttons">
      <a href="/playground.html" class="btn">Try AI Playground</a>
      <a href="/engineer.html" class="btn">Work with Engineer</a>
      <a href="/plans.html" class="btn">View Plans</a>
    </div>
  </main>

  <footer>
    © 2025 CodeGoldenAI. Powered by GoldenSpaceAI.
  </footer>
</body>
</html>
