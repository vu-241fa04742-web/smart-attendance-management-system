const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(path.join(dataDir, "attendance.db"));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','faculty','student')),
    roll_no TEXT,
    department TEXT DEFAULT 'CSE',
    year TEXT DEFAULT '3rd Year'
  )`);
  await run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    attendance_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Present','Absent')),
    marked_by INTEGER NOT NULL,
    UNIQUE(student_id, subject_id, attendance_date),
    FOREIGN KEY(student_id) REFERENCES users(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    FOREIGN KEY(marked_by) REFERENCES users(id)
  )`);

  const count = await get("SELECT COUNT(*) AS n FROM users");
  if (count.n === 0) {
    const demoUsers = [
      ["Administrator", "admin", "demo123", "admin", null],
      ["Faculty Demo", "faculty", "demo123", "faculty", null],
      ["Student Demo", "student", "demo123", "student", "CSE001"]
    ];
    for (const [name, username, password, role, roll] of demoUsers) {
      await run(
        "INSERT INTO users(name, username, password_hash, role, roll_no) VALUES(?,?,?,?,?)",
        [name, username, bcrypt.hashSync(password, 10), role, roll]
      );
    }
  }

  const subjectCount = await get("SELECT COUNT(*) AS n FROM subjects");
  if (subjectCount.n === 0) {
    for (const [name, code] of [
      ["Database Management Systems", "DBMS"],
      ["Data Structures", "DS"],
      ["Operating Systems", "OS"],
      ["Computer Networks", "CN"]
    ]) await run("INSERT INTO subjects(name, code) VALUES(?,?)", [name, code]);
  }
}

module.exports = { db, run, get, all, initDb };
