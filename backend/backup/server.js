require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { run, get, all, initDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

function safeUser(user) {
  if (!user) return null;
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, message: "Smart Attendance API is running" }));

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: "Username and password are required" });
    const user = await get("SELECT * FROM users WHERE username = ?", [String(username).trim()]);
    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    res.json({ message: "Login successful", user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

app.get("/api/subjects", async (_req, res) => {
  try { res.json(await all("SELECT * FROM subjects ORDER BY name")); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.get("/api/students", async (_req, res) => {
  try {
    res.json(await all("SELECT id, name, username, roll_no, department, year FROM users WHERE role='student' ORDER BY name"));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/students", async (req, res) => {
  try {
    const { name, username, password, roll_no, department, year } = req.body || {};
    if (!name || !username || !password || !roll_no) return res.status(400).json({ message: "Name, username, password and roll number are required" });
    const result = await run(
      "INSERT INTO users(name, username, password_hash, role, roll_no, department, year) VALUES(?,?,?,?,?,?,?)",
      [name.trim(), username.trim(), bcrypt.hashSync(password, 10), "student", roll_no.trim(), department || "CSE", year || "3rd Year"]
    );
    res.status(201).json({ message: "Student added", id: result.id });
  } catch (err) {
    res.status(400).json({ message: err.message.includes("UNIQUE") ? "Username already exists" : err.message });
  }
});

app.post("/api/attendance", async (req, res) => {
  try {
    const { student_id, subject_id, attendance_date, status, marked_by } = req.body || {};
    if (!student_id || !subject_id || !attendance_date || !["Present", "Absent"].includes(status) || !marked_by) {
      return res.status(400).json({ message: "All attendance fields are required" });
    }
    const marker = await get("SELECT role FROM users WHERE id=?", [marked_by]);
    if (!marker || !["admin", "faculty"].includes(marker.role)) return res.status(403).json({ message: "Only faculty or admin can mark attendance" });
    await run(
      `INSERT INTO attendance(student_id, subject_id, attendance_date, status, marked_by)
       VALUES(?,?,?,?,?)
       ON CONFLICT(student_id, subject_id, attendance_date)
       DO UPDATE SET status=excluded.status, marked_by=excluded.marked_by`,
      [student_id, subject_id, attendance_date, status, marked_by]
    );
    res.json({ message: "Attendance saved successfully" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get("/api/attendance", async (req, res) => {
  try {
    const { student_id, subject_id, date } = req.query;
    let sql = `SELECT a.id, a.attendance_date, a.status, u.name AS student_name, u.roll_no,
                      s.name AS subject_name, s.code AS subject_code
               FROM attendance a
               JOIN users u ON u.id=a.student_id
               JOIN subjects s ON s.id=a.subject_id
               WHERE 1=1`;
    const params = [];
    if (student_id) { sql += " AND a.student_id=?"; params.push(student_id); }
    if (subject_id) { sql += " AND a.subject_id=?"; params.push(subject_id); }
    if (date) { sql += " AND a.attendance_date=?"; params.push(date); }
    sql += " ORDER BY a.attendance_date DESC, u.name";
    res.json(await all(sql, params));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get("/api/students/:id/summary", async (req, res) => {
  try {
    const rows = await all(
      `SELECT s.name AS subject_name, COUNT(a.id) AS total,
       SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present
       FROM subjects s LEFT JOIN attendance a ON a.subject_id=s.id AND a.student_id=?
       GROUP BY s.id ORDER BY s.name`, [req.params.id]
    );
    const history = await all(
      `SELECT a.attendance_date, a.status, s.name AS subject_name
       FROM attendance a JOIN subjects s ON s.id=a.subject_id
       WHERE a.student_id=? ORDER BY a.attendance_date DESC`, [req.params.id]
    );
    res.json({ summary: rows.map(r => ({ ...r, percentage: r.total ? Math.round((r.present / r.total) * 100) : 0 })), history });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get("/api/reports", async (_req, res) => {
  try {
    const rows = await all(
      `SELECT u.id, u.name, u.roll_no, COUNT(a.id) AS total,
       SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present
       FROM users u LEFT JOIN attendance a ON a.student_id=u.id
       WHERE u.role='student' GROUP BY u.id ORDER BY u.name`
    );
    res.json(rows.map(r => ({ ...r, present: r.present || 0, total: r.total || 0, percentage: r.total ? Math.round((r.present / r.total) * 100) : 0 })));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
}).catch(err => {
  console.error("Database initialization failed:", err);
  process.exit(1);
});
