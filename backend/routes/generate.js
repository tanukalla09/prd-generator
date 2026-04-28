const express = require('express');
const router = express.Router();
const axios = require('axios');
const Groq = require('groq-sdk');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const PDFDocument = require('pdfkit');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function fetchRepoData(repoUrl) {
  const cleanUrl = repoUrl.replace('git@github.com:', 'github.com/').replace('.git', '').trim();
  const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');

  const [, owner, repo] = match;
  const headers = { 
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  };
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

  // Fetch repo metadata
  const repoData = await axios.get(baseUrl, { headers });

  // Fetch README
  let readme = '';
  try {
    const readmeRes = await axios.get(`${baseUrl}/readme`, { headers });
    readme = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8');
  } catch {
    readme = 'No README found';
  }

  // Fetch file tree
  let fileTree = '';
  let codeContents = '';
  try {
    const treeRes = await axios.get(
      `${baseUrl}/git/trees/HEAD?recursive=1`, 
      { headers }
    );
    
    const files = treeRes.data.tree
      .filter(function(f) { return f.type === 'blob'; })
      .map(function(f) { return f.path; });

    fileTree = files.join('\n');

    // Read important code files
    // Sort to prioritize model and route files first
    files.sort(function(a, b) {
      const priority = ['model', 'route', 'controller', 'schema', 'entity'];
      const aPriority = priority.some(function(p) { return a.toLowerCase().includes(p); });
      const bPriority = priority.some(function(p) { return b.toLowerCase().includes(p); });
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      return 0;
    });

    const importantFiles = files.filter(function(f) {
      return (
        f.endsWith('.py') ||
        f.endsWith('.js') ||
        f.endsWith('.ts') ||
        f.endsWith('.jsx') ||
        f.endsWith('.tsx') ||
        f.endsWith('.java') ||
        f.endsWith('.go') ||
        f.endsWith('.rs') ||
        f.endsWith('.cpp') ||
        f.endsWith('.c') ||
        f.endsWith('.cs') ||
        f.endsWith('.php') ||
        f === 'package.json' ||
        f === 'requirements.txt' ||
        f === 'Dockerfile' ||
        f === 'docker-compose.yml' ||
        f === '.env.example' ||
        f === 'config.py' ||
        f === 'settings.py' ||
        f === 'app.py' ||
        f === 'main.py' ||
        f === 'index.js' ||
        f === 'server.js' ||
        f === 'app.js'
      );
    }).slice(0, 15); // max 15 files to stay within limits

    // Read each file content
    const fileContents = await Promise.all(
      importantFiles.map(async function(filePath) {
        try {
          const fileRes = await axios.get(
            `${baseUrl}/contents/${filePath}`,
            { headers }
          );
          if (fileRes.data.encoding === 'base64') {
            const content = Buffer.from(fileRes.data.content, 'base64').toString('utf-8');
            return `\n\n=== FILE: ${filePath} ===\n${content.slice(0, 500)}`;
          }
          return '';
        } catch {
          return '';
        }
      })
    );

    codeContents = fileContents.join('\n');
  } catch {
    fileTree = 'Could not fetch file tree';
  }

  // Fetch dependencies
  let dependencies = '';
  try {
    const pkgRes = await axios.get(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`
    );
    dependencies = JSON.stringify(pkgRes.data.dependencies || {});
  } catch {
    try {
      const reqRes = await axios.get(
        `https://raw.githubusercontent.com/${owner}/${repo}/main/requirements.txt`
      );
      dependencies = reqRes.data;
    } catch {
      dependencies = 'No dependency file found';
    }
  }

  return {
    name: repoData.data.name,
    description: repoData.data.description || 'No description',
    language: repoData.data.language || 'Unknown',
    stars: repoData.data.stargazers_count,
    forks: repoData.data.forks_count,
    topics: repoData.data.topics ? repoData.data.topics.join(', ') : '',
    readme: readme.slice(0, 2000),
    fileTree: fileTree.slice(0, 1000),
    codeContents: codeContents.slice(0, 4000),
    dependencies
  };
}
async function generatePRD(repoInfo) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a senior product manager who writes professional, detailed Product Requirements Documents based on deep analysis of actual code and repository structure.'
      },
      {
        role: 'user',
        content: `Analyze this GitHub repository thoroughly and write a complete professional Product Requirements Document (PRD).

REPOSITORY DETAILS:
Name: ${repoInfo.name}
Description: ${repoInfo.description}
Primary Language: ${repoInfo.language}
Stars: ${repoInfo.stars}
Forks: ${repoInfo.forks}
Topics: ${repoInfo.topics}

README CONTENT:
${repoInfo.readme}

FULL FILE STRUCTURE:
${repoInfo.fileTree}

ACTUAL CODE CONTENT FROM KEY FILES:
${repoInfo.codeContents}

DEPENDENCIES:
${repoInfo.dependencies}

CRITICAL INSTRUCTIONS:
- IGNORE the repository name completely when deciding what the project is
- ONLY determine what the project does by reading the ACTUAL CODE FILES provided
- Look at route files, model files, controller files to understand real features
- Look at database models to understand what data is being managed
- Look at API endpoints to understand what actions are supported
- If you see models like Student, Teacher, Class, Subject — it is a School Management System
- If you see models like Order, Product, Cart — it is an E-commerce system
- NEVER guess based on the repo name — always read the code
- Do NOT make up features — only write what is actually in the code files

Write a PRD with these exact sections:
1. Project Overview (based on actual code analysis)
2. Problem Statement (what problem does this code actually solve)
3. Target Users (who would use this based on what the code does)
4. Key Features (extracted from actual code files — be specific)
5. Technical Architecture (based on actual file structure and code)
6. Installation Guide (based on actual files found)
7. Dependencies and Requirements (from actual dependency files)
8. Setup and Run Instructions (based on actual code)
9. API Endpoints / Functions (if found in code)
10. Possible Integrations (based on actual code)
11. Alternative Tools
12. Recommended Infrastructure (mention Hostinger at https://hostinger.com and GoDaddy at https://godaddy.com)

Make it detailed, accurate, and based entirely on the actual code — not assumptions.`
      }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 3000
  });

  return chatCompletion.choices[0].message.content;
}

// Generate DOCX
async function generateDOCX(prdText, repoName) {
  const lines = prdText.split('\n');
  const children = [];

  children.push(
    new Paragraph({
      text: 'Product Requirements Document',
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      text: repoName,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({ text: '' })
  );

  for (const line of lines) {
    if (line.startsWith('## ')) {
      children.push(new Paragraph({
        text: line.replace('## ', ''),
        heading: HeadingLevel.HEADING_2,
      }));
    } else if (line.startsWith('**') && line.endsWith('**')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/\*\*/g, ''), bold: true })],
      }));
    } else if (line.trim().startsWith('* ')) {
      children.push(new Paragraph({
        text: line.replace('* ', ''),
        bullet: { level: 0 },
      }));
    } else if (line.trim() !== '') {
      children.push(new Paragraph({ text: line }));
    } else {
      children.push(new Paragraph({ text: '' }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}

// Generate PDF
function generatePDF(prdText, repoName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Product Requirements Document', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text(repoName, { align: 'center' });
    doc.moveDown(2);

    // Content
    const lines = prdText.split('\n');
    for (const line of lines) {
      if (line.startsWith('## ')) {
        doc.moveDown();
        doc.fontSize(14).font('Helvetica-Bold').text(line.replace('## ', ''));
        doc.moveDown(0.5);
      } else if (line.startsWith('**') && line.endsWith('**')) {
        doc.fontSize(11).font('Helvetica-Bold').text(line.replace(/\*\*/g, ''));
      } else if (line.trim().startsWith('* ')) {
        doc.fontSize(10).font('Helvetica').text('  • ' + line.replace('* ', ''));
      } else if (line.trim() !== '') {
        doc.fontSize(10).font('Helvetica').text(line);
      } else {
        doc.moveDown(0.3);
      }
    }

    doc.end();
  });
}

// Main generate route
router.post('/generate', async (req, res) => {
  const { repoUrl } = req.body;

  if (!repoUrl || !repoUrl.includes('github.com')) {
    return res.status(400).json({
      error: 'Please enter a valid GitHub repository URL.'
    });
  }

  try {
    console.log('Fetching repo: ' + repoUrl);
    const repoInfo = await fetchRepoData(repoUrl);

    console.log('Generating PRD for: ' + repoInfo.name);
    const prd = await generatePRD(repoInfo);

    res.json({
      success: true,
      repoName: repoInfo.name,
      prd
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Download route
router.post('/download', async (req, res) => {
  const { prd, repoName, format } = req.body;

  try {
    if (format === 'txt') {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${repoName}-PRD.txt"`);
      return res.send(prd);
    }

    if (format === 'docx') {
      const buffer = await generateDOCX(prd, repoName);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${repoName}-PRD.docx"`);
      return res.send(buffer);
    }

    if (format === 'pdf') {
      const buffer = await generatePDF(prd, repoName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${repoName}-PRD.pdf"`);
      return res.send(buffer);
    }

    res.status(400).json({ error: 'Invalid format' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Download failed' });
  }
});

module.exports = router;