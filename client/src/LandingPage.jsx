import './LandingPage.css'

function LandingPage({ onLogin, onRegister }) {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="#home" aria-label="DevFlow AI home">
          <span className="landing-brand-mark" aria-hidden="true">D</span>
          <span>DevFlow <span>AI</span></span>
        </a>
        <nav aria-label="Landing navigation">
          <a href="#features">Features</a>
          <button type="button" className="landing-login" onClick={onLogin}>Login</button>
          <button type="button" className="landing-get-started" onClick={onRegister}>Get Started</button>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-kicker"><span aria-hidden="true" /> A focused workspace for software teams</span>
            <h1 aria-label="Build Faster, Code Smarter with DevFlow AI">Build Faster,<br />Code Smarter with<br /><span>DevFlow AI</span></h1>
            <p>Bring project and issue tracking, API testing, rule-based code review, and team collaboration together in one workspace. Code review uses deterministic checks; no AI model is called.</p>
            <div className="landing-hero-actions">
              <button type="button" className="landing-primary" onClick={onRegister}>Get Started Free <span aria-hidden="true">→</span></button>
              <button type="button" className="landing-secondary" onClick={onLogin}>Login</button>
            </div>
          </div>

          <div className="landing-illustration" aria-label="Decorative code window">
            <div className="code-window">
              <div className="code-window-top"><span /><span /><span /><small>workspace.js</small></div>
              <div className="code-window-body">
                <div className="code-window-gutter">01<br />02<br />03<br />04<br />05<br />06<br />07</div>
                <div className="code-window-lines" aria-hidden="true">
                  <p><b>const</b> workspace = {'{'}</p>
                  <p className="indent"><i>projects</i>: <em>trackWork</em>(),</p>
                  <p className="indent"><i>issues</i>: <em>stayFocused</em>(),</p>
                  <p className="indent"><i>review</i>: <em>checkWithRules</em>(),</p>
                  <p className="indent"><i>team</i>: <em>buildTogether</em>(),</p>
                  <p>{'}'}</p>
                  <p><span className="code-cursor" /></p>
                </div>
              </div>
              <div className="code-window-status"><span /> Ready to build</div>
            </div>
            <span className="illustration-orbit orbit-one" aria-hidden="true" />
            <span className="illustration-orbit orbit-two" aria-hidden="true" />
            <span className="illustration-spark spark-one" aria-hidden="true">✦</span>
            <span className="illustration-spark spark-two" aria-hidden="true">✧</span>
          </div>
        </section>

        <section className="landing-features" id="features" aria-labelledby="landing-features-title">
          <div className="landing-features-heading">
            <span className="landing-kicker">TOOLS THAT WORK TOGETHER</span>
            <h2 id="landing-features-title">Everything your team needs to move forward</h2>
          </div>
          <div className="landing-feature-grid">
            <article><span className="feature-icon feature-indigo" aria-hidden="true">⌘</span><div><h3>Code Review</h3><p>Deterministic, rule-based checks.</p></div></article>
            <article><span className="feature-icon feature-blue" aria-hidden="true">⇄</span><div><h3>API Tester</h3><p>Send requests and inspect responses.</p></div></article>
            <article><span className="feature-icon feature-violet" aria-hidden="true">▱</span><div><h3>Project Management</h3><p>Keep work organized and visible.</p></div></article>
            <article><span className="feature-icon feature-teal" aria-hidden="true">◎</span><div><h3>Team Collaboration</h3><p>Work together in one workspace.</p></div></article>
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage
