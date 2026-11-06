const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "faculty", "student"],
    required: true
  },
  roll_no: { type: String, default: null },
  department: { type: String, default: "CSE" },
  year: { type: String, default: "3rd Year" }
});

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true }
});

const attendanceSchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  subject_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true
  },
  attendance_date: { type: String, required: true },
  status: {
    type: String,
    enum: ["Present", "Absent"],
    required: true
  },
  marked_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

attendanceSchema.index(
  { student_id: 1, subject_id: 1, attendance_date: 1 },
  { unique: true }
);

const User = mongoose.model("User", userSchema);
const Subject = mongoose.model("Subject", subjectSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);

async function initDb() {
 await mongoose.connect(process.env.MONGO_URI);

  console.log("MongoDB connected successfully");

  const userCount = await User.countDocuments();

  if (userCount === 0) {
    await User.insertMany([
      {
        name: "Administrator",
        username: "admin",
        password_hash: bcrypt.hashSync("demo123", 10),
        role: "admin"
      },
      {
        name: "Faculty Demo",
        username: "faculty",
        password_hash: bcrypt.hashSync("demo123", 10),
        role: "faculty"
      },
      {
        name: "Student Demo",
        username: "student",
        password_hash: bcrypt.hashSync("demo123", 10),
        role: "student",
        roll_no: "CSE001"
      }
    ]);
  }

  const subjectCount = await Subject.countDocuments();

  if (subjectCount === 0) {
    await Subject.insertMany([
      { name: "Database Management Systems", code: "DBMS" },
      { name: "Data Structures", code: "DS" },
      { name: "Operating Systems", code: "OS" },
      { name: "Computer Networks", code: "CN" }
    ]);
  }

  console.log("Database initialized successfully");
}

module.exports = {
  User,
  Subject,
  Attendance,
  initDb
};