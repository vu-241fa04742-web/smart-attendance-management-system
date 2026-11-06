require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const { User, Subject, Attendance, initDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"] }));
app.use(express.json());

function safeUser(user) {
  if (!user) return null;

  const data = user.toObject ? user.toObject() : user;
  const { _id, __v, password_hash, ...rest } = data;

  return { id: _id.toString(), ...rest };
}

function safeSubject(subject) {
  const data = subject.toObject ? subject.toObject() : subject;
  const { _id, __v, ...rest } = data;

  return { id: _id.toString(), ...rest };
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function isDuplicateError(err) {
  return err.code === 11000;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "Smart Attendance API is running"
  });
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required"
      });
    }

    const user = await User.findOne({
      username: String(username).trim()
    });

    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    res.json({
      message: "Login successful",
      user: safeUser(user)
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// GET SUBJECTS
app.get("/api/subjects", async (_req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    res.json(subjects.map(safeSubject));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET STUDENTS
app.get("/api/students", async (_req, res) => {
  try {
    const students = await User.find(
      { role: "student" },
      { password_hash: 0 }
    ).sort({ name: 1 });

    res.json(students.map(safeUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADD STUDENT
app.post("/api/students", async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      roll_no,
      department,
      year
    } = req.body || {};

    if (!name || !username || !password || !roll_no) {
      return res.status(400).json({
        message: "Name, username, password and roll number are required"
      });
    }

    const student = await User.create({
      name: name.trim(),
      username: username.trim(),
      password_hash: bcrypt.hashSync(password, 10),
      role: "student",
      roll_no: roll_no.trim(),
      department: department || "CSE",
      year: year || "3rd Year"
    });

    res.status(201).json({
      message: "Student added",
      id: student._id.toString()
    });
  } catch (err) {
    res.status(400).json({
      message: isDuplicateError(err)
        ? "Username already exists"
        : err.message
    });
  }
});

// GET FACULTY
app.get("/api/faculty", async (_req, res) => {
  try {
    const faculty = await User.find(
      { role: "faculty" },
      { password_hash: 0 }
    ).sort({ name: 1 });

    res.json(faculty.map(safeUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ADD FACULTY
app.post("/api/faculty", async (req, res) => {
  try {
    const { name, username, password, department } = req.body || {};

    if (!name || !username || !password) {
      return res.status(400).json({
        message: "Name, username and password are required"
      });
    }

    const faculty = await User.create({
      name: name.trim(),
      username: username.trim(),
      password_hash: bcrypt.hashSync(password, 10),
      role: "faculty",
      department: department || "CSE"
    });

    res.status(201).json({
      message: "Faculty added successfully",
      id: faculty._id.toString()
    });
  } catch (err) {
    res.status(400).json({
      message: err.code === 11000
        ? "Username already exists"
        : err.message
    });
  }
});


// MARK ATTENDANCE
app.post("/api/attendance", async (req, res) => {
  try {
    const {
      student_id,
      subject_id,
      attendance_date,
      status,
      marked_by
    } = req.body || {};

    if (
      !student_id ||
      !subject_id ||
      !attendance_date ||
      !["Present", "Absent"].includes(status) ||
      !marked_by
    ) {
      return res.status(400).json({
        message: "All attendance fields are required"
      });
    }

    if (
      !validId(student_id) ||
      !validId(subject_id) ||
      !validId(marked_by)
    ) {
      return res.status(400).json({
        message: "Invalid student, subject or marker ID"
      });
    }

    const marker = await User.findById(marked_by);

    if (!marker || !["admin", "faculty"].includes(marker.role)) {
      return res.status(403).json({
        message: "Only faculty or admin can mark attendance"
      });
    }

    const student = await User.findOne({
      _id: student_id,
      role: "student"
    });

    const subject = await Subject.findById(subject_id);

    if (!student || !subject) {
      return res.status(404).json({
        message: "Student or subject not found"
      });
    }

    await Attendance.findOneAndUpdate(
      {
        student_id,
        subject_id,
        attendance_date
      },
      {
        $set: {
          status,
          marked_by
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    res.json({
      message: "Attendance saved successfully"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET ATTENDANCE
app.get("/api/attendance", async (req, res) => {
  try {
    const { student_id, subject_id, date } = req.query;

    const filter = {};

    if (student_id) {
      if (!validId(student_id)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      filter.student_id = student_id;
    }

    if (subject_id) {
      if (!validId(subject_id)) {
        return res.status(400).json({ message: "Invalid subject ID" });
      }
      filter.subject_id = subject_id;
    }

    if (date) {
      filter.attendance_date = date;
    }

    const records = await Attendance.find(filter)
      .populate("student_id", "name roll_no")
      .populate("subject_id", "name code")
      .sort({ attendance_date: -1 });

    const result = records.map(record => ({
      id: record._id.toString(),
      attendance_date: record.attendance_date,
      status: record.status,
      student_name: record.student_id?.name || "",
      roll_no: record.student_id?.roll_no || "",
      subject_name: record.subject_id?.name || "",
      subject_code: record.subject_id?.code || ""
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// STUDENT ATTENDANCE SUMMARY
app.get("/api/students/:id/summary", async (req, res) => {
  try {
    const studentId = req.params.id;

    if (!validId(studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const subjects = await Subject.find().sort({ name: 1 });
    const records = await Attendance.find({
      student_id: studentId
    }).populate("subject_id", "name");

    const summary = subjects.map(subject => {
      const subjectRecords = records.filter(
        record =>
          record.subject_id &&
          record.subject_id._id.toString() === subject._id.toString()
      );

      const total = subjectRecords.length;
      const present = subjectRecords.filter(
        record => record.status === "Present"
      ).length;

      return {
        subject_name: subject.name,
        total,
        present,
        percentage: total
          ? Math.round((present / total) * 100)
          : 0
      };
    });

    const history = records
      .map(record => ({
        attendance_date: record.attendance_date,
        status: record.status,
        subject_name: record.subject_id?.name || ""
      }))
      .sort((a, b) =>
        b.attendance_date.localeCompare(a.attendance_date)
      );

    res.json({ summary, history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// REPORTS
app.get("/api/reports", async (_req, res) => {
  try {
    const students = await User.find({ role: "student" }).sort({
      name: 1
    });

    const result = await Promise.all(
      students.map(async student => {
        const records = await Attendance.find({
          student_id: student._id
        });

        const total = records.length;
        const present = records.filter(
          record => record.status === "Present"
        ).length;

        return {
          id: student._id.toString(),
          name: student.name,
          roll_no: student.roll_no,
          total,
          present,
          percentage: total
            ? Math.round((present / total) * 100)
            : 0
        };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// START SERVER
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("Database initialization failed:", err);
    process.exit(1);
  });
