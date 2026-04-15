require("dotenv").config({ override: true });

const express      = require("express");
const cookieParser = require("cookie-parser");
const jwt          = require("jsonwebtoken");
const bcryptjs     = require("bcryptjs");
const multer       = require("multer");
const crypto       = require("crypto");
const path         = require("path");
const fs           = require("fs");
const pool         = require("./data/db");

const app    = express();
const SECRET = process.env.JWT_SECRET || "studylink_jwt_secret_2026";
const PORT   = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_q, _f, cb) => cb(null, uploadDir),
    filename   : (_q,  f, cb) => cb(null, `${Date.now()}-${f.originalname}`),
  }),
  limits    : { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_q, f, cb) =>
    cb(null, [".pdf",".doc",".docx",".txt",".zip",".py",".js"]
      .includes(path.extname(f.originalname).toLowerCase())),
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "pug");
app.use(express.static("public"));

function requireAuth(role) {
  return async (req, res, next) => {
    try {
      const token = req.cookies.sms_token;
      if (!token) return res.redirect("/login");
      const payload = jwt.verify(token, SECRET);
      if (payload.role !== role) return res.redirect("/login");
      if (role === "student") {
        const [rows] = await pool.execute("SELECT * FROM students WHERE user_email=?", [payload.email]);
        if (!rows[0]) return res.redirect("/login");
        req.profile = { studentID: rows[0].student_id, name: rows[0].name, major: rows[0].major, gpa: rows[0].gpa, email: payload.email };
      } else {
        const [rows] = await pool.execute("SELECT * FROM educators WHERE user_email=?", [payload.email]);
        if (!rows[0]) return res.redirect("/login");
        req.profile = { educatorID: rows[0].educator_id, name: rows[0].name, department: rows[0].department, email: payload.email };
      }
      next();
    } catch { res.clearCookie("sms_token"); res.redirect("/login"); }
  };
}

async function requireEnrolled(req, res, next) {
  const classId = req.params.classId || req.params.id;
  const [rows] = await pool.execute(
    "SELECT 1 FROM enrollments WHERE class_id=? AND student_id=?",
    [classId, req.profile.studentID]);
  if (!rows.length) return res.status(403).send("You are not enrolled in this class.");
  next();
}

async function requireOwner(req, res, next) {
  const classId = req.params.classId || req.params.id;
  const [rows] = await pool.execute(
    "SELECT 1 FROM classes WHERE class_id=? AND educator_id=?",
    [classId, req.profile.educatorID]);
  if (!rows.length) return res.status(403).send("You do not own this class.");
  next();
}

app.get("/",       (_req, res) => res.render("home"));
app.get("/login",  (_req, res) => res.render("login"));
app.get("/signup", (_req, res) => res.render("signup"));

app.post("/api/login", async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const [rows] = await pool.execute("SELECT * FROM users WHERE email=? AND role=?", [email, role]);
    if (!rows.length || !(await bcryptjs.compare(password, rows[0].password)))
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    const token = jwt.sign({ email: rows[0].email, role: rows[0].role }, SECRET, { expiresIn: "8h" });
    res.cookie("sms_token", token, { httpOnly: true, sameSite: "lax", maxAge: 8*3600*1000 });
    res.json({ success: true, token, role: rows[0].role });
  } catch (err) { console.error("[Login]", err.message); res.status(500).json({ success: false, message: "Server error." }); }
});

app.post("/api/signup", async (req, res) => {
  const { name, email, password, role, major, department } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ success: false, message: "All fields are required." });
  if (password.length < 6)
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ex] = await conn.execute("SELECT id FROM users WHERE email=?", [email]);
    if (ex.length) { await conn.rollback(); return res.status(409).json({ success: false, message: "Email already registered." }); }
    const hash = await bcryptjs.hash(password, 10);
    await conn.execute("INSERT INTO users (email,password,role) VALUES (?,?,?)", [email, hash, role]);
    if (role === "student") {
      await conn.execute("INSERT INTO students (student_id,user_email,name,major,gpa) VALUES (?,?,?,?,?)",
        [`A${Date.now().toString().slice(-8)}`, email, name, major || "Undeclared", 0.00]);
    } else {
      await conn.execute("INSERT INTO educators (educator_id,user_email,name,department) VALUES (?,?,?,?)",
        [`ED${Date.now().toString().slice(-5)}`, email, name, department || "General"]);
    }
    await conn.commit();
    res.status(201).json({ success: true });
  } catch (err) { await conn.rollback(); console.error("[Signup]", err.message); res.status(500).json({ success: false, message: "Signup failed." }); }
  finally { conn.release(); }
});

app.post("/api/logout", (_req, res) => { res.clearCookie("sms_token"); res.json({ success: true }); });


app.get("/student/dashboard", requireAuth("student"), async (req, res) => {
  try {
    const [classes] = await pool.execute(`
      SELECT c.class_id, c.name, c.subject, c.section, c.cover_color,
             e.name AS educatorName,
             (SELECT COUNT(*) FROM assignments a WHERE a.class_id=c.class_id) AS totalAssignments,
             (SELECT COUNT(*) FROM assignments a
              JOIN submissions s ON s.assignment_id=a.assignment_id AND s.student_id=?
              WHERE a.class_id=c.class_id AND s.status IN ('Turned In','Returned')) AS doneAssignments
      FROM classes c
      JOIN enrollments en ON en.class_id=c.class_id
      JOIN educators e ON e.educator_id=c.educator_id
      WHERE en.student_id=?
      ORDER BY c.created_at DESC`,
      [req.profile.studentID, req.profile.studentID]);
    res.render("student_home", { user: req.profile, classes });
  } catch (err) { console.error("[StudentHome]", err.message); res.status(500).send("Error"); }
});

// Student joins a class by code
app.post("/api/join-class", requireAuth("student"), async (req, res) => {
  const { classCode } = req.body;
  if (!classCode) return res.status(400).json({ success: false, message: "Class code required." });
  try {
    const [cls] = await pool.execute("SELECT * FROM classes WHERE class_code=?", [classCode.trim().toUpperCase()]);
    if (!cls.length) return res.status(404).json({ success: false, message: "No class found with that code." });
    const [already] = await pool.execute(
      "SELECT 1 FROM enrollments WHERE class_id=? AND student_id=?",
      [cls[0].class_id, req.profile.studentID]);
    if (already.length) return res.status(409).json({ success: false, message: "You are already enrolled in this class." });
    await pool.execute("INSERT INTO enrollments (class_id,student_id) VALUES (?,?)",
      [cls[0].class_id, req.profile.studentID]);
    res.json({ success: true, className: cls[0].name });
  } catch (err) { console.error("[JoinClass]", err.message); res.status(500).json({ success: false }); }
});

// Student leaves a class
app.delete("/api/leave-class/:classId", requireAuth("student"), async (req, res) => {
  try {
    await pool.execute("DELETE FROM enrollments WHERE class_id=? AND student_id=?",
      [req.params.classId, req.profile.studentID]);
    res.json({ success: true });
  } catch (err) { console.error("[LeaveClass]", err.message); res.status(500).json({ success: false }); }
});

// Class stream (announcements + assignments)
app.get("/student/class/:classId", requireAuth("student"), requireEnrolled, async (req, res) => {
  try {
    const [cls] = await pool.execute(`
      SELECT c.*, e.name AS educatorName, e.department
      FROM classes c JOIN educators e ON e.educator_id=c.educator_id
      WHERE c.class_id=?`, [req.params.classId]);
    if (!cls.length) return res.status(404).send("Class not found.");

    const [assignments] = await pool.execute(`
      SELECT a.*, COALESCE(s.status,'Assigned') AS submissionStatus,
             s.grade, s.feedback, s.file_path AS filePath
      FROM assignments a
      LEFT JOIN submissions s ON s.assignment_id=a.assignment_id AND s.student_id=?
      WHERE a.class_id=?
      ORDER BY a.created_at DESC`,
      [req.profile.studentID, req.params.classId]);

    const [announcements] = await pool.execute(`
      SELECT ann.*, e.name AS educatorName
      FROM announcements ann JOIN educators e ON e.educator_id=ann.educator_id
      WHERE ann.class_id=?
      ORDER BY ann.created_at DESC`,
      [req.params.classId]);

    const [classmates] = await pool.execute(`
      SELECT s.name, s.student_id FROM students s
      JOIN enrollments en ON en.student_id=s.student_id
      WHERE en.class_id=?`, [req.params.classId]);

    res.render("student_class", {
      user: req.profile,
      cls: cls[0],
      assignments,
      announcements,
      classmates,
      activeTab: req.query.tab || "stream" 
    });
  } catch (err) { console.error("[StudentClass]", err.message); res.status(500).send("Error"); }
});

// Student assignment detail page
app.get("/student/class/:classId/assignment/:assignmentId", requireAuth("student"), requireEnrolled, async (req, res) => {
  try {
    const [asgRows] = await pool.execute(`
      SELECT a.*, c.name AS className, c.cover_color, e.name AS educatorName
      FROM assignments a
      JOIN classes c ON c.class_id=a.class_id
      JOIN educators e ON e.educator_id=a.author_id
      WHERE a.assignment_id=? AND a.class_id=?`,
      [req.params.assignmentId, req.params.classId]);
    if (!asgRows.length) return res.status(404).send("Assignment not found.");

    const [subRows] = await pool.execute(
      "SELECT * FROM submissions WHERE assignment_id=? AND student_id=?",
      [req.params.assignmentId, req.profile.studentID]);

    const sub = subRows[0] || { status: "Assigned" };
    res.render("student_assignment", { user: req.profile, assignment: asgRows[0], submission: sub });
  } catch (err) { console.error("[StudentAssignment]", err.message); res.status(500).send("Error"); }
});

// Submit assignment
app.post("/api/submit", requireAuth("student"), upload.single("submissionFile"), async (req, res) => {
  const { assignmentId } = req.body;
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    await pool.execute(`
      INSERT INTO submissions (submission_id,assignment_id,student_id,status,file_path,turned_in_at)
      VALUES (?,?,?,'Turned In',?,NOW())
      ON DUPLICATE KEY UPDATE status='Turned In', file_path=COALESCE(VALUES(file_path),file_path), turned_in_at=NOW()`,
      [`SUB${Date.now()}`, assignmentId, req.profile.studentID, filePath]);
    res.json({ success: true });
  } catch (err) { console.error("[Submit]", err.message); res.status(500).json({ success: false }); }
});

// Unsubmit assignment
app.post("/api/unsubmit", requireAuth("student"), async (req, res) => {
  const { assignmentId } = req.body;
  try {
    await pool.execute(
      "UPDATE submissions SET status='Assigned', file_path=NULL, turned_in_at=NULL WHERE assignment_id=? AND student_id=?",
      [assignmentId, req.profile.studentID]);
    res.json({ success: true });
  } catch (err) { console.error("[Unsubmit]", err.message); res.status(500).json({ success: false }); }
});


// Educator home — their classes
app.get("/educator/dashboard", requireAuth("educator"), async (req, res) => {
  try {
    const [classes] = await pool.execute(`
      SELECT c.*,
        (SELECT COUNT(*) FROM enrollments en WHERE en.class_id=c.class_id) AS studentCount,
        (SELECT COUNT(*) FROM assignments a WHERE a.class_id=c.class_id) AS assignmentCount
      FROM classes c
      WHERE c.educator_id=?
      ORDER BY c.created_at DESC`,
      [req.profile.educatorID]);
    res.render("educator_home", { user: req.profile, classes });
  } catch (err) { console.error("[EducatorHome]", err.message); res.status(500).send("Error"); }
});

// Create a class
app.post("/api/create-class", requireAuth("educator"), async (req, res) => {
  const { name, subject, section, description, coverColor } = req.body;
  if (!name || !subject) return res.status(400).json({ success: false, message: "Name and subject required." });
  const classId   = `CLS${Date.now()}`;
  const classCode = crypto.randomBytes(3).toString("hex").toUpperCase(); // e.g. A3F9C1
  const colors    = ["#1565C0","#2E7D32","#6A1B9A","#AD1457","#E65100","#00695C","#283593","#4E342E"];
  const color     = coverColor || colors[Math.floor(Math.random() * colors.length)];
  try {
    await pool.execute(
      "INSERT INTO classes (class_id,educator_id,name,subject,section,description,class_code,cover_color) VALUES (?,?,?,?,?,?,?,?)",
      [classId, req.profile.educatorID, name, subject, section || "", description || "", classCode, color]);
    res.status(201).json({ success: true, classId, classCode });
  } catch (err) { console.error("[CreateClass]", err.message); res.status(500).json({ success: false }); }
});

// Delete a class
app.delete("/api/class/:id", requireAuth("educator"), requireOwner, async (req, res) => {
  try {
    await pool.execute("DELETE FROM classes WHERE class_id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error("[DeleteClass]", err.message); res.status(500).json({ success: false }); }
});

// Educator class view — stream + people + assignments
app.get("/educator/class/:classId", requireAuth("educator"), requireOwner, async (req, res) => {
  try {
    const [cls] = await pool.execute("SELECT * FROM classes WHERE class_id=?", [req.params.classId]);
    if (!cls.length) return res.status(404).send("Class not found.");

    const [assignments] = await pool.execute(`
      SELECT a.*,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id=a.assignment_id) AS submittedCount,
        (SELECT COUNT(*) FROM enrollments en WHERE en.class_id=a.class_id) AS totalStudents
      FROM assignments a WHERE a.class_id=?
      ORDER BY a.created_at DESC`, [req.params.classId]);

    const [students] = await pool.execute(`
      SELECT s.student_id, s.name, s.major, s.gpa, en.enrolled_at
      FROM students s JOIN enrollments en ON en.student_id=s.student_id
      WHERE en.class_id=? ORDER BY s.name ASC`, [req.params.classId]);

    const [announcements] = await pool.execute(`
      SELECT * FROM announcements WHERE class_id=? ORDER BY created_at DESC`,
      [req.params.classId]);

    res.render("educator_class", {
      user: req.profile, cls: cls[0], assignments, students, announcements,
      tab: req.query.tab || "stream",
    });
  } catch (err) { console.error("[EducatorClass]", err.message); res.status(500).send("Error"); }
});

// Create assignment in a class
app.post("/api/class/:classId/assignment", requireAuth("educator"), requireOwner, async (req, res) => {
  const { title, description, dueDate, points } = req.body;
  if (!title || !dueDate) return res.status(400).json({ success: false, message: "Title and due date required." });
  try {
    const id = `ASG${Date.now()}`;
    await pool.execute(
      "INSERT INTO assignments (assignment_id,class_id,author_id,title,description,due_date,points) VALUES (?,?,?,?,?,?,?)",
      [id, req.params.classId, req.profile.educatorID, title, description || "", dueDate, points || 100]);
    res.status(201).json({ success: true, assignmentId: id });
  } catch (err) { console.error("[CreateAssignment]", err.message); res.status(500).json({ success: false }); }
});

// Delete assignment
app.delete("/api/assignment/:id", requireAuth("educator"), async (req, res) => {
  try {
    await pool.execute("DELETE FROM assignments WHERE assignment_id=? AND author_id=?",
      [req.params.id, req.profile.educatorID]);
    res.json({ success: true });
  } catch (err) { console.error("[DeleteAssignment]", err.message); res.status(500).json({ success: false }); }
});

// Remove a student from class
app.delete("/api/class/:classId/student/:studentId", requireAuth("educator"), requireOwner, async (req, res) => {
  try {
    await pool.execute("DELETE FROM enrollments WHERE class_id=? AND student_id=?",
      [req.params.classId, req.params.studentId]);
    res.json({ success: true });
  } catch (err) { console.error("[RemoveStudent]", err.message); res.status(500).json({ success: false }); }
});

// Educator grades a specific assignment — see all submissions
app.get("/educator/class/:classId/assignment/:assignmentId", requireAuth("educator"), requireOwner, async (req, res) => {
  try {
    const [asgRows] = await pool.execute(
      "SELECT * FROM assignments WHERE assignment_id=? AND class_id=?",
      [req.params.assignmentId, req.params.classId]);
    if (!asgRows.length) return res.status(404).send("Assignment not found.");

    // All enrolled students + their submission status
    const [rows] = await pool.execute(`
      SELECT st.student_id, st.name AS studentName,
             COALESCE(s.status,'Assigned') AS status,
             s.submission_id AS submissionID,
             s.grade, s.feedback, s.file_path AS filePath,
             DATE_FORMAT(s.turned_in_at,'%d %b %Y') AS turnedInAt
      FROM enrollments en
      JOIN students st ON st.student_id=en.student_id
      LEFT JOIN submissions s ON s.assignment_id=? AND s.student_id=en.student_id
      WHERE en.class_id=?
      ORDER BY st.name ASC`,
      [req.params.assignmentId, req.params.classId]);

    const [cls] = await pool.execute("SELECT name, cover_color FROM classes WHERE class_id=?", [req.params.classId]);
    res.render("educator_grading", {
      user: req.profile, assignment: asgRows[0],
      studentSubmissions: rows, cls: cls[0],
    });
  } catch (err) { console.error("[EducatorGrading]", err.message); res.status(500).send("Error"); }
});

// Save grade
app.post("/api/grade", requireAuth("educator"), async (req, res) => {
  const { submissionID, studentId, assignmentId, grade, feedback } = req.body;
  try {
    if (submissionID) {
      await pool.execute(
        "UPDATE submissions SET grade=?,feedback=?,status='Returned' WHERE submission_id=?",
        [grade, feedback, submissionID]);
    } else {
      // Student hasn't submitted yet but educator wants to add a grade
      await pool.execute(`
        INSERT INTO submissions (submission_id,assignment_id,student_id,status,grade,feedback)
        VALUES (?,?,?,'Returned',?,?)
        ON DUPLICATE KEY UPDATE grade=?,feedback=?,status='Returned'`,
        [`SUB${Date.now()}`, assignmentId, studentId, grade, feedback, grade, feedback]);
    }
    res.json({ success: true });
  } catch (err) { console.error("[Grade]", err.message); res.status(500).json({ success: false }); }
});

// Post announcement to class
app.post("/api/class/:classId/announce", requireAuth("educator"), requireOwner, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ success: false, message: "Message required." });
  try {
    await pool.execute("INSERT INTO announcements (class_id,educator_id,message) VALUES (?,?,?)",
      [req.params.classId, req.profile.educatorID, message]);
    res.json({ success: true });
  } catch (err) { console.error("[Announce]", err.message); res.status(500).json({ success: false }); }
});

// Analytics for a class
app.get("/api/class/:classId/analytics", requireAuth("educator"), requireOwner, async (req, res) => {
  try {
    const gm = {"A+":100,"A":95,"A-":90,"B+":87,"B":83,"B-":80,"C+":77,"C":73,"C-":70,"D":60,"F":50};
    const [rows] = await pool.execute(`
      SELECT s.grade, st.name AS studentName
      FROM submissions s
      JOIN assignments a ON a.assignment_id=s.assignment_id
      JOIN students st ON st.student_id=s.student_id
      WHERE a.class_id=? AND s.grade IS NOT NULL`,
      [req.params.classId]);

    const gradeCount = {};
    rows.forEach(r => { gradeCount[r.grade] = (gradeCount[r.grade] || 0) + 1; });
    const labels = Object.keys(gradeCount);
    const data   = Object.values(gradeCount);

    const scores = rows.map(r => gm[r.grade]).filter(Boolean);
    const avg    = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;

    res.json({ labels, data, avg, total: rows.length });
  } catch (err) { console.error("[Analytics]", err.message); res.status(500).json({ success: false }); }
});

app.listen(PORT, () => console.log(`StudyLink v2 → http://localhost:${PORT}`));