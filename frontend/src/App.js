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
  const [step, setStep] = useState('');
  const [format, setFormat] = useState('txt');
  const [downloading, setDownloading] = useState(false);

  const handleGenerate = async () => {
    if (!url) return setError('Please enter a GitHub URL');
    if (!url.includes('github.com'))
      return setError('Please enter a valid GitHub repository URL.');

    setError('');
    setLoading(true);
    setPrd('');

    try {
      setStep('Fetching repository data...');
      await new Promise(r => setTimeout(r, 1000));

      setStep('AI is generating your PRD...');
      const res = await axios.post(`${API_BASE_URL}/api/generate`, { repoUrl: url });

      setStep('PRD Generated!');
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
        {loading && <p className="step">{step}</p>}
      </div>

      {!prd && !loading && (
        <div className="features">
          <h2>Features</h2>
          <div className="bento-grid">
            <div className="tile large">
              <h3>AI-Powered Generation</h3>
              <p>Leverage advanced AI to transform GitHub repositories into professional PRDs instantly.</p>
            </div>
            <div className="tile">
              <h3>Lightning Fast</h3>
              <p>Get your PRD in seconds, not hours.</p>
            </div>
            <div className="tile">
              <h3>Multiple Formats</h3>
              <p>Export as TXT, PDF, or DOCX to fit your workflow.</p>
            </div>
            <div className="tile">
              <h3>GitHub Integration</h3>
              <p>Directly analyze any public GitHub repo with a simple URL.</p>
            </div>
            <div className="tile">
              <h3>Professional Quality</h3>
              <p>Generate detailed, structured PRDs ready for stakeholders.</p>
            </div>
            <div className="tile small">
              <h3>Free to Use</h3>
              <p>No subscriptions or hidden fees.</p>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

export default App;