const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./approval_system.db');

db.serialize(() => {
  // 1. 申請單主表
  db.run(`CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    total_amount REAL,
    department TEXT,
    business_justification TEXT,
    attachment_path TEXT,
    is_pre_approved INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. 成本明細表 (Line-item costs)
  db.run(`CREATE TABLE IF NOT EXISTS line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER,
    item_name TEXT,
    cost REAL,
    FOREIGN KEY(request_id) REFERENCES requests(id)
  )`);

  // 3. 審批紀錄表 (Approval Stages)
  db.run(`CREATE TABLE IF NOT EXISTS approval_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER,
    stage_level INTEGER,
    reviewer_role TEXT,
    action TEXT,
    comment TEXT,
    actioned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;