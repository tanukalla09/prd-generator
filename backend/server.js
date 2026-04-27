const express = require('express');
const cors = require('cors');

// Only load .env file in development, not in production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
app.use(cors());
app.use(express.json());

const generateRoute = require('./routes/generate');
app.use('/api', generateRoute);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`GROQ KEY exists: ${!!process.env.GROQ_API_KEY}`);
  console.log(`GITHUB TOKEN exists: ${!!process.env.GITHUB_TOKEN}`);
});