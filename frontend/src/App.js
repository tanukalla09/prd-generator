import { useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'https://prd-generator-3oqy.onrender.com';

function App() {
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [prd, setPrd] = useState('');
  const [repoName, setRepoName] = useState('');
  const [error, setError] = useState('');
  const [steps, setSteps] = useState([]);
  const [format, setFormat] = useState('txt');
  const [downloading, setDownloading] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleGenerate = async () => {
    if (!url) return setError('Please enter a GitHub URL');
    if (!url.includes('github.com'))
      return setError('Please enter a valid GitHub repository URL.');

    setError('');
    setLoading(true);
    setPrd('');

    try {
      setSteps([
        { text: 'Fetching repo data', done: false },
        { text: 'Reading README...', done: false },
        { text: 'Generating PRD...', done: false }
      ]);

      await new Promise(r => setTimeout(r, 1000));
      setSteps([
        { text: 'Fetching repo data', done: true },
        { text: 'Reading README...', done: false },
        { text: 'Generating PRD...', done: false }
      ]);

      await new Promise(r => setTimeout(r, 1000));
      setSteps([
        { text: 'Fetching repo data', done: true },
        { text: 'Reading README...', done: true },
        { text: 'Generating PRD...', done: false }
      ]);

      const res = await axios.post(`${API_BASE_URL}/api/generate`, { repoUrl: url });

      setSteps([
        { text: 'Fetching repo data', done: true },
        { text: 'Reading README...', done: true },
        { text: 'Generating PRD...', done: true }
      ]);

      await new Promise(r => setTimeout(r, 500));
      setPrd(res.data.prd);
      setRepoName(res.data.repoName);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/download`,
        { prd, repoName, format },
        { responseType: 'blob' }
      );

      const extensions = { txt: '.txt', pdf: '.pdf', docx: '.docx' };
      const mimeTypes = {
        txt: 'text/plain',
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
      
      const blob = new Blob([res.data], { type: mimeTypes[format] });
      const link = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = link;
      a.download = repoName + '-PRD' + extensions[format];
      a.click();
    } catch (err) {
      setError('Download failed. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-logo">RepoDoc AI</div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it Works</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <button className="nav-cta" onClick={handleGenerate}>Try Free</button>
      </nav>
      <div className="hero">
        <h1>GitHub Repo to PRD Generator</h1>
        <p>Paste a GitHub URL. Get a professional PRD instantly.</p>

        <div className="input-row">
          <input
            type="text"
            placeholder="https://github.com/username/repo"
            value={url}
            onChange={function(e) { setUrl(e.target.value); }}
          />
          <button onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate PRD'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {loading && (
          <div className="steps-progress">
            <div className="spinner"></div>
            {steps.map(function(s, i) {
              return (
                <div key={i} className={'progress-step ' + (s.done ? 'done' : 'pending')}>
                  <span className="progress-icon">{s.done ? '✅' : '⏳'}</span>
                  <span>{s.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
        {!prd && !loading && (
        <div className="how-it-works" id="how-it-works">
          <h2>How it Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Paste GitHub URL</h3>
              <p>Copy any public GitHub repository link and paste it in the input box.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>AI Generates PRD</h3>
              <p>Our AI reads your README, dependencies and repo data to write a full PRD.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Download Instantly</h3>
              <p>Get your PRD as TXT, PDF or DOCX — ready to share with anyone.</p>
            </div>
          </div>
        </div>
      )}
        <div className="features" id="features">
          <h2>Everything you need to ship faster</h2>
          <p className="features-sub">From GitHub repo to investor-ready PRD in under 30 seconds.</p>
          <div className="bento-grid">

            <div className="tile tile-wide">
              <div className="tile-icon">🤖</div>
              <h3>AI-Powered PRD Generation</h3>
              <p>Paste any GitHub URL and our AI reads your README, dependencies, and repo metadata to generate a complete 10-section Product Requirements Document — ready to share with investors, clients, or your team.</p>
              <div className="tile-tag">Core Feature</div>
            </div>

            <div className="tile tile-tall">
              <div className="tile-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>Get a full PRD in under 30 seconds. No manual writing, no templates, no wasted hours.</p>
              <div className="tile-stat">30s</div>
            </div>

            <div className="tile">
              <div className="tile-icon">📄</div>
              <h3>3 Download Formats</h3>
              <p>Export as TXT, PDF, or Word DOCX — whatever your workflow needs.</p>
            </div>

            <div className="tile">
              <div className="tile-icon">🔗</div>
              <h3>GitHub Integration</h3>
              <p>Works with browser URLs, HTTPS clone links, and SSH URLs.</p>
            </div>

            <div className="tile tile-wide">
              <div className="tile-icon">🏗️</div>
              <h3>Infrastructure Recommendations</h3>
              <p>Every PRD includes hosting and domain recommendations so your team can go from idea to deployed — without extra research.</p>
              <div className="tile-tag">Built-in</div>
            </div>

            <div className="tile">
              <div className="tile-icon">🎯</div>
              <h3>Stakeholder Ready</h3>
              <p>Generated for non-technical readers — investors, managers, clients.</p>
            </div>

          </div>
        </div>
      

      {loading && (
        <div className="result skeleton">
          <div className="result-header">
            <div className="skeleton-block title"></div>
            <div className="skeleton-block download"></div>
          </div>
          <div className="skeleton-block content"></div>
          <div className="affiliate">
            <div className="skeleton-block affiliate-title"></div>
            <div className="affiliate-cards">
              <div className="skeleton-block card"></div>
              <div className="skeleton-block card"></div>
            </div>
          </div>
        </div>
      )}

      {prd && (
        <div className="result">
          <div className="result-header">
            <h2>PRD for: {repoName}</h2>
            <div className="download-section">
              <select
                value={format}
                onChange={function(e) { setFormat(e.target.value); }}
                className="format-select"
              >
                <option value="txt">Text (.txt)</option>
                <option value="pdf">PDF (.pdf)</option>
                <option value="docx">Word (.docx)</option>
              </select>
              <button
                className="download-btn"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? 'Downloading...' : 'Download PRD'}
              </button>
            </div>
          </div>
          <pre className="prd-content">{prd}</pre>

          <div className="affiliate">
            <h3>Recommended Infrastructure</h3>
            <div className="affiliate-cards">
              <a href="https://hostinger.com" target="_blank" rel="noreferrer" className="card">
                <h4>Hostinger</h4>
                <p>Best for beginners. Starts at $2.99/mo</p>
                <span>Get Hosting</span>
              </a>
              <a href="https://godaddy.com" target="_blank" rel="noreferrer" className="card">
                <h4>GoDaddy</h4>
                <p>Domains and hosting made easy</p>
                <span>Get Domain</span>
              </a>
            </div>
          </div>
        </div>
      )}
    <footer className="footer">
        <span>Made by <strong>Purple Merit</strong></span>
        <span className="footer-divider">|</span>
        <a href="#privacy" onClick={function(e){ e.preventDefault(); setShowPrivacy(true); }}>Privacy Policy</a>
        <span className="footer-divider">|</span>
        <a href="mailto:contact@purplemerit.com">Contact</a>
      </footer>
    {showPrivacy && (
        <div className="privacy-overlay" onClick={function(){ setShowPrivacy(false); }}>
          <div className="privacy-modal" onClick={function(e){ e.stopPropagation(); }}>
            <button className="privacy-close" onClick={function(){ setShowPrivacy(false); }}>✕</button>
            <h2>Privacy Policy</h2>
            <p><strong>Last updated:</strong> April 2026</p>
            <h3>What we collect</h3>
            <p>We only process the GitHub repository URL you submit. We do not store any personal data or repository content after your session ends.</p>
            <h3>How we use it</h3>
            <p>Your GitHub URL is used solely to fetch repository metadata and generate a PRD. It is never shared with third parties.</p>
            <h3>Cookies</h3>
            <p>We do not use tracking cookies or analytics that identify individual users.</p>
            <h3>Affiliate Links</h3>
            <p>Our PRDs contain affiliate links to hosting providers. We may earn a commission if you purchase through these links at no extra cost to you.</p>
            <h3>Contact</h3>
            <p>For privacy questions email us at contact@purplemerit.com</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;