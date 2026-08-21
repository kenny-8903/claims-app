const db = require('./database');
const { determineApprovalFlow } = require('./routingLogic');

function createSubmission(data, callback) {
  const { title, total_amount, department, business_justification, attachment_path, is_pre_approved, items } = data;

  db.run(
    `INSERT INTO requests (title, total_amount, department, business_justification, attachment_path, is_pre_approved)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, total_amount, department, business_justification, attachment_path, is_pre_approved ? 1 : 0],
    function (err) {
      if (err) return callback(err);
      const requestId = this.lastID;

      if (items && items.length > 0) {
        const stmt = db.prepare(`INSERT INTO line_items (request_id, item_name, cost) VALUES (?, ?, ?)`);
        items.forEach((item) => stmt.run(requestId, item.item_name, item.cost));
        stmt.finalize();
      }
      callback(null, { requestId, message: 'Submission Successful' });
    }
  );
}

function processReview(requestId, reviewerRole, currentLevel, action, comment, callback) {
  db.get(
    `SELECT * FROM requests WHERE id = ?`,
    [requestId],
    (err, request) => {
      if (err || !request) return callback(err || new Error('Request not found'));

      const flow = determineApprovalFlow(request.total_amount, request.is_pre_approved === 1);

      db.run(
        `INSERT INTO approval_logs (request_id, stage_level, reviewer_role, action, comment) VALUES (?, ?, ?, ?, ?)`,
        [requestId, currentLevel, reviewerRole, action, comment]
      );

      if (action === 'REJECT') {
        db.run(`UPDATE requests SET status = 'REJECTED' WHERE id = ?`, [requestId]);
        return callback(null, { status: 'REJECTED' });
      }

      const currentIndex = flow.indexOf(currentLevel);

      if (currentIndex < flow.length - 1) {
        const nextLevel = flow[currentIndex + 1];
        db.run(`UPDATE requests SET current_level = ? WHERE id = ?`, [nextLevel, requestId]);
        callback(null, { status: 'PENDING_NEXT_LEVEL', nextLevel });
      } else {
        db.run(`UPDATE requests SET status = 'APPROVED' WHERE id = ?`, [requestId]);
        callback(null, { status: 'APPROVED' });
      }
    }
  );
}

function checkStalledRequests(callback) {
  const STALL_LIMIT_HOURS = 48;
  const sql = `SELECT * FROM requests WHERE status = 'PENDING' AND created_at < datetime('now', '-${STALL_LIMIT_HOURS} hours')`;

  db.all(sql, (err, stalledRequests) => {
    if (err) {
      if (callback) return callback(err);
      return;
    }
    if (stalledRequests) {
      stalledRequests.forEach((req) => {
        console.log(`[AUTOMATED REMINDER] Ping reviewer for Request #${req.id} (Stalled at Level ${req.current_level})`);
      });
    }
    if (callback) callback(null, stalledRequests || []);
  });
}

module.exports = { createSubmission, processReview, checkStalledRequests };