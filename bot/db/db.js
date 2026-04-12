const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Store DB in project root as data.db
const dbPath = path.resolve(__dirname, '../db/data.db');
const db = new sqlite3.Database(dbPath);

const { userId, username } = require('../config').admin;

function normalizeTelegramUsername(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .toLowerCase();
}

const normalizedAdminUsername = normalizeTelegramUsername(username) || null;

function normalizeTelegramId(value) {
  if (value == null) return '';
  return String(value).trim();
}

function parseConfiguredAdminIds(rawValue) {
  const raw = normalizeTelegramId(rawValue);
  if (!raw) return [];
  const fragments = raw
    .split(/[,\s;|]+/g)
    .map((entry) => normalizeTelegramId(entry))
    .filter(Boolean);
  const expanded = [];
  for (const fragment of fragments) {
    const cleaned = fragment.replace(/^["'\[\](){}]+|["'\[\](){}]+$/g, '');
    if (cleaned) expanded.push(cleaned);
    const digitOnly = cleaned.match(/-?\d+/g);
    if (digitOnly?.length) {
      expanded.push(...digitOnly);
    }
  }
  return Array.from(new Set(expanded.map((entry) => normalizeTelegramId(entry)).filter(Boolean)));
}

const configuredAdminIds = parseConfiguredAdminIds(userId);
const primaryConfiguredAdminId = configuredAdminIds[0] || normalizeTelegramId(userId);

function isConfiguredAdmin(id) {
  const currentId = normalizeTelegramId(id);
  return Boolean(currentId) && configuredAdminIds.includes(currentId);
}

function buildConfiguredAdminUser(id) {
  const normalizedId = normalizeTelegramId(id);
  const numericId = Number.parseInt(normalizedId, 10);
  return {
    telegram_id: Number.isFinite(numericId) ? numericId : normalizedId || null,
    username: normalizedAdminUsername,
    role: 'ADMIN',
    timestamp: new Date().toISOString(),
  };
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    role TEXT CHECK(role IN ('ADMIN','USER')) NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(
    `INSERT OR IGNORE INTO users (telegram_id, username, role) VALUES (?, ?, 'ADMIN')`,
    [primaryConfiguredAdminId, normalizedAdminUsername],
  );

  db.run(`CREATE TABLE IF NOT EXISTS script_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id TEXT NOT NULL,
    script_type TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_script_versions_lookup ON script_versions(script_id, script_type, version_number)`);
});

function getUser(id, usernameOrCb, maybeCb) {
  const username = typeof usernameOrCb === 'string' ? usernameOrCb : null;
  const cb = typeof usernameOrCb === 'function' ? usernameOrCb : maybeCb;
  db.get(`SELECT * FROM users WHERE telegram_id = ?`, [id], (e, r) => {
    if (e) {
      return cb(isConfiguredAdmin(id) ? buildConfiguredAdminUser(id) : null);
    }
    if (r) return cb(r);
    const normalizedCurrentUsername = normalizeTelegramUsername(username);
    if (normalizedCurrentUsername && normalizedAdminUsername && normalizedCurrentUsername === normalizedAdminUsername) {
      return cb(buildConfiguredAdminUser(id));
    }
    if (normalizedCurrentUsername) {
      return db.get(
        `SELECT telegram_id, username, role, timestamp
         FROM users
         WHERE lower(username) = lower(?) AND role = 'ADMIN'
         ORDER BY timestamp DESC
         LIMIT 1`,
        [normalizedCurrentUsername],
        (usernameLookupErr, usernameMatch) => {
          if (usernameLookupErr || !usernameMatch) {
            if (isConfiguredAdmin(id)) return cb(buildConfiguredAdminUser(id));
            return cb(null);
          }
          const normalizedId = normalizeTelegramId(id);
          const fallbackId = normalizeTelegramId(usernameMatch.telegram_id);
          const resolvedId = normalizedId || fallbackId || null;
          cb({
            ...usernameMatch,
            telegram_id: resolvedId,
            role: 'ADMIN',
          });
        },
      );
    }
    if (isConfiguredAdmin(id)) return cb(buildConfiguredAdminUser(id));
    cb(null);
  });
}
function addUser(id, username, role = 'USER', cb = () => {}) {
  db.run(`INSERT OR IGNORE INTO users (telegram_id, username, role) VALUES (?, ?, ?)`, [id, username, role], cb);
}
function getUserList(cb) {
  db.all(`SELECT * FROM users ORDER BY role DESC`, [], (e, r) => {
    if (e) {
      console.error('Database error in getUserList:', e);
      return cb(e, null);
    }
    cb(null, r || []);
  });
}
function promoteUser(id, cb = () => {}) {
  db.run(`UPDATE users SET role = 'ADMIN' WHERE telegram_id = ?`, [id], cb);
}
function removeUser(id, cb = () => {}) {
  db.run(`DELETE FROM users WHERE telegram_id = ?`, [id], cb);
}
function isAdmin(id, usernameOrCb, maybeCb) {
  const username = typeof usernameOrCb === 'string' ? usernameOrCb : null;
  const cb = typeof usernameOrCb === 'function' ? usernameOrCb : maybeCb;
  if (isConfiguredAdmin(id)) return cb(true);
  const normalizedCurrentUsername = normalizeTelegramUsername(username);
  if (normalizedCurrentUsername && normalizedAdminUsername) {
    if (normalizedCurrentUsername === normalizedAdminUsername) {
      return cb(true);
    }
  }
  db.get(`SELECT role FROM users WHERE telegram_id = ?`, [id], (e, r) => {
    if (e) return cb(false);
    if (r?.role === 'ADMIN') return cb(true);
    if (!normalizedCurrentUsername) return cb(false);
    db.get(
      `SELECT role FROM users WHERE lower(username) = lower(?) AND role = 'ADMIN' LIMIT 1`,
      [normalizedCurrentUsername],
      (usernameLookupErr, usernameRow) => {
        if (usernameLookupErr) return cb(false);
        cb(usernameRow?.role === 'ADMIN');
      },
    );
  });
}
function expireInactiveUsers(days = 30) {
  db.run(
    `DELETE FROM users WHERE role != 'ADMIN' AND timestamp <= datetime('now', ? || ' days')`,
    [`-${days}`],
  );
}

function getNextScriptVersion(scriptId, scriptType) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT MAX(version_number) AS max_version FROM script_versions WHERE script_id = ? AND script_type = ?`;
    db.get(sql, [scriptId, scriptType], (err, row) => {
      if (err) return reject(err);
      const next = Number(row?.max_version || 0) + 1;
      resolve(next);
    });
  });
}

async function saveScriptVersion(scriptId, scriptType, payload, createdBy = null) {
  if (!scriptId || !scriptType || !payload) return null;
  const version = await getNextScriptVersion(scriptId, scriptType);
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO script_versions (script_id, script_type, version_number, payload, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run([
      String(scriptId),
      String(scriptType),
      version,
      JSON.stringify(payload),
      createdBy
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, version });
      }
    });
    stmt.finalize();
  });
}

function listScriptVersions(scriptId, scriptType, limit = 10) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, script_id, script_type, version_number, created_by, created_at
      FROM script_versions
      WHERE script_id = ? AND script_type = ?
      ORDER BY version_number DESC
      LIMIT ?
    `;
    db.all(sql, [String(scriptId), String(scriptType), limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function getScriptVersion(scriptId, scriptType, versionNumber) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, script_id, script_type, version_number, payload, created_by, created_at
      FROM script_versions
      WHERE script_id = ? AND script_type = ? AND version_number = ?
      LIMIT 1
    `;
    db.get(sql, [String(scriptId), String(scriptType), Number(versionNumber)], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      let payload = null;
      try {
        payload = JSON.parse(row.payload);
      } catch (_) {}
      resolve({ ...row, payload });
    });
  });
}

function getLatestScriptVersion(scriptId, scriptType) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, script_id, script_type, version_number, payload, created_by, created_at
      FROM script_versions
      WHERE script_id = ? AND script_type = ?
      ORDER BY version_number DESC
      LIMIT 1
    `;
    db.get(sql, [String(scriptId), String(scriptType)], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      let payload = null;
      try {
        payload = JSON.parse(row.payload);
      } catch (_) {}
      resolve({ ...row, payload });
    });
  });
}

module.exports = {
  getUser, addUser, getUserList, promoteUser, removeUser,
  isAdmin, expireInactiveUsers,
  saveScriptVersion,
  listScriptVersions,
  getScriptVersion,
  getLatestScriptVersion
};
