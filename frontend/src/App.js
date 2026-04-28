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
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('prd-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [format, setFormat] = useState('txt');
  const [downloading, setDownloading] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

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

      const newEntry = {
        repoName: res.data.repoName,
        repoUrl: url,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()
      };
      const updatedHistory = [newEntry, ...history].slice(0, 3);
      setHistory(updatedHistory);
      localStorage.setItem('prd-history', JSON.stringify(updatedHistory));
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
      const updatedHistory = history.map(function(h, i) {
        if (i === 0) return { ...h, format: format };
        return h;
      });
      setHistory(updatedHistory);
      localStorage.setItem('prd-history', JSON.stringify(updatedHistory));
    }
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-logo">RepoDoc AI</div>
        <div className="nav-links">
          <a href="#features" onClick={function(){ setActiveTab('home'); }}>Features</a>
          <a href="#how-it-works" onClick={function(){ setActiveTab('home'); }}>How it Works</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          
            <a href="#history" className={activeTab === 'history' ? 'nav-active' : ''} onClick={function(e){ e.preventDefault(); setActiveTab('history'); }}>History ({history.length})</a>
        </div>
        <button className="nav-cta" onClick={function(){ setActiveTab('home'); handleGenerate(); }}>Try Free</button>
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
      {activeTab === 'history' && (
        <div className="history-page">
          <div className="history-header">
            <h1>Your PRD History</h1>
            <p>Last 3 PRDs you generated</p>
          </div>

          {history.length === 0 ? (
            <div className="history-empty">
              <div className="empty-icon">📭</div>
              <h3>No history yet</h3>
              <p>Generate your first PRD to see it here</p>
              <button className="nav-cta" onClick={function(){ setActiveTab('home'); }}>
                Generate PRD
              </button>
            </div>
          ) : (
            <div className="history-list">
              {history.map(function(h, i) {
                return (
                  <div key={i} className="history-card">
                    <div className="history-card-top">
                      <div className="history-card-icon">📄</div>
                      <div className="history-card-info">
                        <div className="history-name">{h.repoName}</div>
                        <a href={h.repoUrl} target="_blank" rel="noreferrer" className="history-url">
                          {h.repoUrl}
                        </a>
                      </div>
                      {h.format && (
                        <span className="history-format">{h.format.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="history-card-bottom">
                      <span className="history-meta">Generated on {h.date} at {h.time}</span>
                      <button
                        className="history-btn"
                        onClick={function(){
                          setUrl(h.repoUrl);
                          setActiveTab('home');
                        }}
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                );
              })}
              <button className="clear-history" onClick={function(){
                setHistory([]);
                localStorage.removeItem('prd-history');
              }}>
                Clear All History
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'home' && !prd && !loading && (
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-number">10K+</div>
            <div className="stat-label">PRDs Generated</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">5K+</div>
            <div className="stat-label">Happy Users</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">30s</div>
            <div className="stat-label">Avg Generation Time</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">$0</div>
            <div className="stat-label">Cost to Start</div>
          </div>
        </div>
      )}
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