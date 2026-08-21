const express = require('express');
const path = require('path');
const { createSubmission, processReview, checkStalledRequests } = require('./services/approvalService');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 將 callback 風格的服務包裝成 Promise
function runService(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// POST /api/submissions — 建立採購申請（含 line items）
app.post('/api/submissions', async (req, res) => {
  try {
    const result = await runService(createSubmission, req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error('createSubmission error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews — 送審批
app.post('/api/reviews', async (req, res) => {
  const { requestId, reviewerRole, currentLevel, action, comment } = req.body;
  if (!requestId || !reviewerRole || !currentLevel || !action) {
    return res.status(400).json({ error: 'Missing required fields: requestId, reviewerRole, currentLevel, action' });
  }
  try {
    const result = await runService(processReview, requestId, reviewerRole, currentLevel, action, comment || '');
    res.status(200).json(result);
  } catch (err) {
    console.error('processReview error:', err.message);
    res.status(err && err.message === 'Request not found' ? 404 : 500).json({ error: err.message });
  }
});

// GET /api/stalled-requests — 查詢超過 48 小時未審的 PENDING 申請
app.get('/api/stalled-requests', async (req, res) => {
  try {
    const result = await runService(checkStalledRequests);
    res.status(200).json({ stalledRequests: result });
  } catch (err) {
    console.error('checkStalledRequests error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 僅在直接執行 `node app.js` 時才啟動伺服器
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;