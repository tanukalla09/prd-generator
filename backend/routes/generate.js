const express = require('express');
const router = express.Router();
const axios = require('axios');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function fetchRepoData(repoUrl) {
  const cleanUrl = repoUrl
    .replace('git@github.com:', 'github.com/')
    .replace('.git', '')
    .trim();
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

  // Fetch full file tree
  let allFiles = [];
  try {
    const treeRes = await axios.get(
      `${baseUrl}/git/trees/HEAD?recursive=1`,
      { headers }
    );
    allFiles = treeRes.data.tree
      .filter(function(f) { return f.type === 'blob'; })
      .map(function(f) { return f.path; });
  } catch {
    console.log('Could not fetch file tree');
  }

  console.log('TOTAL FILES FOUND:', allFiles.length);
  console.log('ALL FILES:', allFiles);

  // Skip useless files
  const skipFolders = [
    'node_modules/', '.git/', '__pycache__/',
    'dist/', 'build/', '.next/', 'venv/',
    'env/', 'coverage/', '.nyc_output/'
  ];
  const skipExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mp3',
    '.ttf', '.woff', '.woff2', '.eot',
    '.min.js', '.min.css', '.map'
  ];

  const codeExtensions = [
    '.py', '.js', '.ts', '.jsx', '.tsx',
    '.java', '.go', '.rs', '.cpp', '.c',
    '.cs', '.php', '.rb', '.swift', '.kt',
    '.html', '.css', '.scss', '.sql',
    '.json', '.yaml', '.yml', '.toml',
    '.sh', '.bash', '.cfg', '.ini', '.md', '.txt'
  ];

  // Filter to only code files
  const codeFiles = allFiles.filter(function(f) {
    const shouldSkipFolder = skipFolders.some(function(folder) {
      return f.startsWith(folder);
    });
    if (shouldSkipFolder) return false;

    const shouldSkipExt = skipExtensions.some(function(ext) {
      return f.endsWith(ext);
    });
    if (shouldSkipExt) return false;

    return codeExtensions.some(function(ext) {
      return f.endsWith(ext);
    });
  });

  // Sort — models, routes, controllers first
  codeFiles.sort(function(a, b) {
    const priority = ['model', 'route', 'controller', 'schema', 'entity', 'service'];
    const aPriority = priority.some(function(p) {
      return a.toLowerCase().includes(p);
    });
    const bPriority = priority.some(function(p) {
      return b.toLowerCase().includes(p);
    });
    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;
    return 0;
  });

  console.log('CODE FILES TO READ:', codeFiles.slice(0, 30));

  // Read each file — up to 40 files
  const filesToRead = codeFiles.slice(0, 40);
  const fileContents = await Promise.all(
    filesToRead.map(async function(filePath) {
      try {
        const fileRes = await axios.get(
          `${baseUrl}/contents/${filePath}`,
          { headers }
        );
        if (fileRes.data.encoding === 'base64') {
          const content = Buffer.from(
            fileRes.data.content, 'base64'
          ).toString('utf-8');
          console.log(`READ FILE: ${filePath} (${content.length} chars)`);
          return `\n\n=============================\nFILE: ${filePath}\n=============================\n${content.slice(0, 1500)}`;
        }
        return '';
      } catch (e) {
        console.log(`FAILED TO READ: ${filePath}`, e.message);
        return '';
      }
    })
  );

  const codeContents = fileContents.filter(Boolean).join('\n');
  console.log('TOTAL CODE CONTENT LENGTH:', codeContents.length);

  return {
    name: repoData.data.name,
    description: repoData.data.description || 'No description provided',
    language: repoData.data.language || 'Unknown',
    stars: repoData.data.stargazers_count,
    forks: repoData.data.forks_count,
    topics: repoData.data.topics ? repoData.data.topics.join(', ') : '',
    readme: readme.slice(0, 3000),
    fileList: codeFiles.join('\n'),
    codeContents: codeContents.slice(0, 15000),
  };
}

async function generatePRD(repoInfo) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `You are a senior product manager who writes accurate Product Requirements Documents based ONLY on actual code analysis. You never guess or assume — you only write what you can see in the code.`
      },
      {
        role: 'user',
        content: `Analyze this GitHub repository's ACTUAL CODE and write a complete PRD.

REPOSITORY NAME: ${repoInfo.name}
DESCRIPTION: ${repoInfo.description}
LANGUAGE: ${repoInfo.language}
STARS: ${repoInfo.stars}
TOPICS: ${repoInfo.topics}

README:
${repoInfo.readme}

COMPLETE FILE LIST:
${repoInfo.fileList}

ACTUAL CODE FROM FILES:
${repoInfo.codeContents}

STRICT RULES:
1. DO NOT use the repository name to decide what the project is
2. READ the actual code files carefully to understand what this project does
3. Look at model/schema files to understand what data is managed (students, teachers, products, orders etc)
4. Look at route files to find actual API endpoints
5. Look at controller files to find actual features
6. If you see Student, Teacher, Class, Subject models — write it is a School Management System
7. If you see Product, Order, Cart models — write it is an E-commerce system
8. ONLY write features that actually exist in the code
9. Be specific — mention actual file names, route names, model names from the code

Write a complete PRD with these sections:
1. Project Overview (what does this project ACTUALLY do based on the code)
2. Problem Statement
3. Target Users
4. Key Features (from actual code — list real routes, models, functions)
5. Technical Architecture (actual file structure and patterns used)
6. Installation Guide (based on actual files found)
7. Dependencies and Requirements (from actual package files)
8. API Endpoints (list actual routes found in code)
9. Database Models (list actual models/schemas found)
10. Setup and Run Instructions
11. Possible Integrations
12. Recommended Infrastructure (mention Hostinger at https://hostinger.com and GoDaddy at https://godaddy.com)`
      }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    max_tokens: 4000
  });

  return chatCompletion.choices[0].message.content;
}

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

router.post('/download', async (req, res) => {
  const { prd, repoName, format } = req.body;

  try {
    if (format === 'txt') {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${repoName}-PRD.txt"`);
      return res.send(prd);
    }

    if (format === 'docx') {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
      const lines = prd.split('\n');
      const children = [];

      children.push(
        new Paragraph({
          text: 'Product Requirements Document',
          heading: HeadingLevel.TITLE,
        }),
        new Paragraph({ text: repoName, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: '' })
      );

      for (const line of lines) {
        if (line.startsWith('## ') || line.startsWith('### ')) {
          children.push(new Paragraph({
            text: line.replace(/#{1,3} /, ''),
            heading: HeadingLevel.HEADING_2,
          }));
        } else if (line.startsWith('**') && line.endsWith('**')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.replace(/\*\*/g, ''), bold: true })],
          }));
        } else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          children.push(new Paragraph({
            text: line.replace(/^[*-] /, ''),
            bullet: { level: 0 },
          }));
        } else if (line.trim() !== '') {
          children.push(new Paragraph({ text: line }));
        } else {
          children.push(new Paragraph({ text: '' }));
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${repoName}-PRD.docx"`);
      return res.send(buffer);
    }

    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${repoName}-PRD.pdf"`);
        res.send(buffer);
      });

      doc.fontSize(24).font('Helvetica-Bold').text('Product Requirements Document', { align: 'center' });
      doc.moveDown();
      doc.fontSize(18).text(repoName, { align: 'center' });
      doc.moveDown(2);

      const lines = prd.split('\n');
      for (const line of lines) {
        if (line.startsWith('## ') || line.startsWith('### ')) {
          doc.moveDown();
          doc.fontSize(14).font('Helvetica-Bold').text(line.replace(/#{1,3} /, ''));
          doc.moveDown(0.5);
        } else if (line.startsWith('**') && line.endsWith('**')) {
          doc.fontSize(11).font('Helvetica-Bold').text(line.replace(/\*\*/g, ''));
        } else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          doc.fontSize(10).font('Helvetica').text('  • ' + line.replace(/^[*-] /, ''));
        } else if (line.trim() !== '') {
          doc.fontSize(10).font('Helvetica').text(line);
        } else {
          doc.moveDown(0.3);
        }
      }
      doc.end();
      return;
    }

    res.status(400).json({ error: 'Invalid format' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Download failed' });
  }
});

module.exports = router;