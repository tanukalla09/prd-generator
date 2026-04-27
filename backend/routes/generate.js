const express = require('express');
const router = express.Router();
const axios = require('axios');
const Groq = require('groq-sdk');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const PDFDocument = require('pdfkit');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function fetchRepoData(repoUrl) {
 const cleanUrl = repoUrl
  .replace('git@github.com:', 'github.com/')
  .replace('.git', '')
  .trim();
const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');

  const [, owner, repo] = match;
  const headers = { Authorization: `token ${process.env.GITHUB_TOKEN}` };
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

  const repoData = await axios.get(baseUrl, { headers });

  let readme = '';
  try {
    const readmeRes = await axios.get(`${baseUrl}/readme`, { headers });
    readme = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8');
  } catch {
    readme = 'No README found';
  }

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
    readme: readme.slice(0, 3000),
    dependencies
  };
}

async function generatePRD(repoInfo) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a senior product manager who writes professional, detailed Product Requirements Documents.'
      },
      {
        role: 'user',
        content: `Based on the GitHub repository information below, write a complete professional Product Requirements Document (PRD).

Repository Name: ${repoInfo.name}
Description: ${repoInfo.description}
Primary Language: ${repoInfo.language}
Stars: ${repoInfo.stars}
README Content: ${repoInfo.readme}
Dependencies: ${repoInfo.dependencies}

Write a PRD with these exact sections:
1. Project Overview
2. Problem Statement
3. Target Users
4. Key Features
5. Installation Guide (step by step)
6. Dependencies and Requirements
7. Setup and Run Instructions
8. Possible Integrations
9. Alternative Tools
10. Recommended Infrastructure (mention Hostinger for hosting at https://hostinger.com and GoDaddy for domain at https://godaddy.com)

Make it professional, detailed, and readable by non-technical stakeholders.`
      }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 2048
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