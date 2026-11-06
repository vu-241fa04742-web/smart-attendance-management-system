import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const today = new Date().toISOString().slice(0, 10);

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("overview");

  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({
    summary: [],
    history: []
  });
  const [reports, setReports] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);

  const [studentForm, setStudentForm] = useState({
    name: "",
    username: "",
    password: "demo123",
    roll_no: "",
    department: "CSE",
    year: "3rd Year"
  });

  const [facultyForm, setFacultyForm] = useState({
    name: "",
    username: "",
    password: "demo123",
    department: "CSE"
  });

  async function loadCommon() {
    const [s, sub] = await Promise.all([
      request("/students"),
      request("/subjects")
    ]);

    setStudents(s);
    setSubjects(sub);

    if (sub.length) {
      setSelectedSubject(String(sub[0].id));
    }
  }

  async function loadFaculty() {
    const data = await request("/faculty");
    setFaculty(data);
  }

  async function loadRecords() {
    const data = await request("/attendance");
    setRecords(data);
  }

  async function loadDashboard(currentUser) {
    await loadCommon();

    if (currentUser.role === "student") {
      setSummary(
        await request(`/students/${currentUser.id}/summary`)
      );
    } else {
      await loadRecords();

      if (currentUser.role === "admin") {
        const [reportData, facultyData] = await Promise.all([
          request("/reports"),
          request("/faculty")
        ]);

        setReports(reportData);
        setFaculty(facultyData);
      }
    }
  }

  useEffect(() => {
    if (user) {
      loadDashboard(user).catch(e => setError(e.message));
    }
  }, [user]);

  async function login(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    try {
      const result = await request("/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      setUser(result.user);
      setTab("overview");
      setPassword("");
    } catch (e) {
      setError(e.message);
    }
  }

  function logout() {
    setUser(null);
    setStudents([]);
    setFaculty([]);
    setRecords([]);
    setSummary({ summary: [], history: [] });
    setReports([]);
    setTab("overview");
    setError("");
    setNotice("");
  }

  async function markAttendance(studentId, status) {
    try {
      await request("/attendance", {
        method: "POST",
        body: JSON.stringify({
          student_id: studentId,
          subject_id: selectedSubject,
          attendance_date: selectedDate,
          status,
          marked_by: user.id
        })
      });

      setNotice("Attendance saved successfully.");
      await loadRecords();
    } catch (e) {
      setError(e.message);
    }
  }

  async function addStudent(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    try {
      await request("/students", {
        method: "POST",
        body: JSON.stringify(studentForm)
      });

      setNotice("Student added successfully.");

      setStudentForm({
        name: "",
        username: "",
        password: "demo123",
        roll_no: "",
        department: "CSE",
        year: "3rd Year"
      });

      setStudents(await request("/students"));

      if (user.role === "admin") {
        setReports(await request("/reports"));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function addFaculty(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    try {
      await request("/faculty", {
        method: "POST",
        body: JSON.stringify(facultyForm)
      });

      setNotice("Faculty added successfully.");

      setFacultyForm({
        name: "",
        username: "",
        password: "demo123",
        department: "CSE"
      });

      await loadFaculty();
    } catch (e) {
      setError(e.message);
    }
  }

  const presentCount = useMemo(
    () => records.filter(r => r.status === "Present").length,
    [records]
  );

  const percent = summary.history.length
    ? Math.round(
        summary.history.filter(r => r.status === "Present").length /
        summary.history.length * 100
      )
    : 0;

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark">SA</div>

          <p className="eyebrow">CAMPUS MANAGEMENT</p>

          <h1>Smart Attendance</h1>

          <p className="muted">
            Sign in to manage and track classroom attendance.
          </p>

          <form onSubmit={login} className="form-stack">
            <label>
              Username
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </label>

            <button className="primary full">Sign in</button>
          </form>

          {error && <p className="alert error">{error}</p>}

          <div className="demo-box">
            <strong>Demo access</strong>
            <span>admin / faculty / student</span>
            <span>Password: demo123</span>
          </div>
        </section>
      </main>
    );
  }

  const navItems =
    user.role === "student"
      ? [
          ["overview", "Overview"],
          ["history", "My attendance"]
        ]
      : user.role === "faculty"
      ? [
          ["overview", "Overview"],
          ["mark", "Mark attendance"],
          ["records", "Attendance records"]
        ]
      : [
          ["overview", "Overview"],
          ["mark", "Mark attendance"],
          ["records", "Attendance records"],
          ["students", "Add student"],
          ["faculty", "Add faculty"],
          ["reports", "Reports"]
        ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark small">SA</span>

          <div>
            <b>Smart Attendance</b>
            <small>Management portal</small>
          </div>
        </div>

        <div className="profile">
          <div className="avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </div>

          <div>
            <b>{user.name}</b>
            <small>{user.role.toUpperCase()}</small>
          </div>
        </div>

        <nav>
          {navItems.map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "nav active" : "nav"}
              onClick={() => {
                setTab(id);
                setError("");
                setNotice("");
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <button className="logout" onClick={logout}>
          Log out
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">DASHBOARD</p>

            <h1>
              {navItems.find(x => x[0] === tab)?.[1] || "Overview"}
            </h1>
          </div>

          <span className="date-chip">
            {new Date().toLocaleDateString()}
          </span>
        </header>

        {error && <p className="alert error">{error}</p>}
        {notice && <p className="alert success">{notice}</p>}

        {tab === "overview" && user.role === "student" && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">STUDENT PORTAL</p>
                <h2>Welcome, {user.name}</h2>
                <p>Here is your attendance summary.</p>
              </div>

              <div className="welcome-icon">✓</div>
            </section>

            <section className="stats">
              <Stat
                label="Attendance percentage"
                value={`${percent}%`}
              />

              <Stat
                label="Classes recorded"
                value={summary.history.length}
              />

              <Stat
                label="Present"
                value={
                  summary.history.filter(
                    x => x.status === "Present"
                  ).length
                }
              />
            </section>

            <section className="panel">
              <PanelTitle title="Subject-wise summary" />

              <DataTable
                headers={[
                  "Subject",
                  "Present",
                  "Total",
                  "Percentage"
                ]}
                rows={summary.summary.map(x => [
                  x.subject_name,
                  x.present || 0,
                  x.total,
                  `${x.percentage}%`
                ])}
              />
            </section>
          </>
        )}

        {tab === "overview" && user.role !== "student" && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">
                  {user.role.toUpperCase()} PORTAL
                </p>

                <h2>Welcome, {user.name}</h2>

                <p>Manage student attendance from one place.</p>
              </div>

              <div className="welcome-icon">✓</div>
            </section>

            <section className="stats">
              <Stat
                label="Total students"
                value={students.length}
              />

              <Stat
                label="Attendance entries"
                value={records.length}
              />

              <Stat
                label="Present entries"
                value={presentCount}
              />
            </section>

            <section className="panel">
              <PanelTitle title="Recent attendance" />

              <DataTable
                headers={[
                  "Student",
                  "Roll number",
                  "Subject",
                  "Date",
                  "Status"
                ]}
                rows={records.slice(0, 8).map(r => [
                  r.student_name,
                  r.roll_no || "-",
                  r.subject_name,
                  r.attendance_date,
                  r.status
                ])}
              />
            </section>
          </>
        )}

        {tab === "mark" && user.role !== "student" && (
          <section className="panel">
            <PanelTitle
              title="Mark student attendance"
              subtitle="Choose a subject and date, then mark each student."
            />

            <div className="toolbar">
              <label>
                Subject

                <select
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date

                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </label>
            </div>

            <DataTable
              headers={[
                "Student",
                "Roll number",
                "Department",
                "Action"
              ]}
              rows={students.map(s => [
                s.name,
                s.roll_no || "-",
                s.department,
                <span className="actions">
                  <button
                    className="present"
                    onClick={() => markAttendance(s.id, "Present")}
                  >
                    Present
                  </button>

                  <button
                    className="absent"
                    onClick={() => markAttendance(s.id, "Absent")}
                  >
                    Absent
                  </button>
                </span>
              ])}
            />
          </section>
        )}

        {tab === "records" && user.role !== "student" && (
          <section className="panel">
            <PanelTitle title="Attendance records" />

            <DataTable
              headers={[
                "Student",
                "Roll number",
                "Subject",
                "Date",
                "Status"
              ]}
              rows={records.map(r => [
                r.student_name,
                r.roll_no || "-",
                r.subject_name,
                r.attendance_date,
                r.status
              ])}
            />
          </section>
        )}

        {tab === "history" && user.role === "student" && (
          <section className="panel">
            <PanelTitle title="My attendance history" />

            <DataTable
              headers={["Date", "Subject", "Status"]}
              rows={summary.history.map(r => [
                r.attendance_date,
                r.subject_name,
                r.status
              ])}
            />
          </section>
        )}

        {tab === "students" && user.role === "admin" && (
          <section className="panel">
            <PanelTitle
              title="Add a student"
              subtitle="Create a student login account."
            />

            <form className="student-form" onSubmit={addStudent}>
              {[
                "name",
                "username",
                "password",
                "roll_no",
                "department",
                "year"
              ].map(key => (
                <label key={key}>
                  {key.replace("_", " ")}

                  <input
                    type={key === "password" ? "password" : "text"}
                    value={studentForm[key]}
                    onChange={e =>
                      setStudentForm({
                        ...studentForm,
                        [key]: e.target.value
                      })
                    }
                    required
                  />
                </label>
              ))}

              <button className="primary">Add student</button>
            </form>

            <PanelTitle title="Student list" />

            <DataTable
              headers={[
                "Name",
                "Username",
                "Roll number",
                "Department",
                "Year"
              ]}
              rows={students.map(s => [
                s.name,
                s.username,
                s.roll_no,
                s.department,
                s.year
              ])}
            />
          </section>
        )}

        {tab === "faculty" && user.role === "admin" && (
          <section className="panel">
            <PanelTitle
              title="Add faculty"
              subtitle="Create a faculty login account."
            />

            <form className="student-form" onSubmit={addFaculty}>
              {["name", "username", "password", "department"].map(key => (
                <label key={key}>
                  {key.replace("_", " ")}

                  <input
                    type={key === "password" ? "password" : "text"}
                    value={facultyForm[key]}
                    onChange={e =>
                      setFacultyForm({
                        ...facultyForm,
                        [key]: e.target.value
                      })
                    }
                    required
                  />
                </label>
              ))}

              <button className="primary">Add faculty</button>
            </form>

            <PanelTitle title="Faculty list" />

            <DataTable
              headers={[
                "Name",
                "Username",
                "Department"
              ]}
              rows={faculty.map(f => [
                f.name,
                f.username,
                f.department || "-"
              ])}
            />
          </section>
        )}

        {tab === "reports" && user.role === "admin" && (
          <section className="panel">
            <PanelTitle
              title="Attendance report"
              subtitle="Overall student attendance summary."
            />

            <DataTable
              headers={[
                "Student",
                "Roll number",
                "Present",
                "Total",
                "Percentage"
              ]}
              rows={reports.map(r => [
                r.name,
                r.roll_no || "-",
                r.present,
                r.total,
                `${r.percentage}%`
              ])}
            />
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ title, subtitle }) {
  return (
    <div className="panel-title">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

function DataTable({ headers, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="empty">
                No records found yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}