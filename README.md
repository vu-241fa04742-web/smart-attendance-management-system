# Smart Attendance Management System

A college-demo project built with **React + Node.js + Express.js + SQLite**.

## Features
- Student, Faculty, and Admin login
- Demo accounts are seeded automatically
- Faculty/Admin can mark attendance by subject and date
- Students can view their own attendance history and percentage
- Admin can add students and view attendance reports
- SQLite database is created automatically on first server start

## Requirements
- Node.js (npm included)
- VS Code (recommended)

## 1. Start the backend
Open a terminal in this project folder:

```bash
cd backend
npm install
npm run dev
```

The API runs at `http://localhost:5000`.

## 2. Start the React frontend
Open a **second terminal** in the project folder:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

Keep both terminals running while using the app.

## Demo login accounts
All demo accounts use password: `demo123`

| Role | Username |
|---|---|
| Admin | admin |
| Faculty | faculty |
| Student | student |

## Notes
- This is an educational demo, not a production-ready attendance or identity system.
- Demo passwords are hashed in SQLite, but the demo credentials are intentionally simple.
- For a real deployment, add proper authorization policies, stronger secrets, HTTPS, input validation, backups, and account-management controls.
- The backend uses a local SQLite file at `backend/data/attendance.db`.
