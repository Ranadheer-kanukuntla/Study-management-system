const express = require("express");
const jwt = require("jsonwebtoken");
const {
  users,
  student,
  educator,
  assignments,
  submissions,
} = require("./data/mockData");
const app = express();
const SECRET_KEY = "smstoken_secret";

app.use(express.json());
app.set("view engine", "pug");
app.use(express.static("public"));

app.get("/login", (req, res) => res.render("login"));

app.post("/api/login", (req, res) => {
  const { email, password, role } = req.body;
  const foundUser = users.find(
    (u) => u.email === email && u.password === password && u.role === role,
  );
  if (foundUser) {
    const token = jwt.sign(
      { email: foundUser.email, role: foundUser.role },
      SECRET_KEY,
    );
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false, message: "Invalid credentials." });
});

app.get("/student/dashboard", (req, res) => {
  const studentTasks = assignments.map((asg) => {
    const sub = submissions.find(
      (s) =>
        s.assignmentID === asg.assignmentID &&
        s.studentID === student.studentID,
    );
    return { ...asg, status: sub ? sub.status : "Pending" };
  });
  res.render("student_dashboard", { user: student, tasks: studentTasks });
});

app.get("/educator/dashboard", (req, res) => {
  const myAssignments = assignments.filter(
    (a) => a.authorID === educator.educatorID,
  );
  res.render("educator_dashboard", { user: educator, tasks: myAssignments });
});

app.get("/assignment/:id", (req, res) => {
  const asg = assignments.find((a) => a.assignmentID === req.params.id);
  const sub = submissions.find(
    (s) =>
      s.assignmentID === req.params.id && s.studentID === student.studentID,
  );
  if (asg) {
    res.render("assignment_details", {
      assignment: asg,
      submission: sub || { status: "Pending" },
      user: student,
    });
  } else {
    res.status(404).send("Not Found");
  }
});

app.get("/educator/assignment/:id", (req, res) => {
  const asg = assignments.find((a) => a.assignmentID === req.params.id);
  const asgSubmissions = submissions.filter(
    (s) => s.assignmentID === req.params.id,
  );
  if (asg) {
    res.render("educator_grading", {
      user: educator,
      assignment: asg,
      studentSubmissions: asgSubmissions,
    });
  } else {
    res.status(404).send("Not Found");
  }
});

app.post("/api/grade", (req, res) => {
  const { submissionID, grade, feedback } = req.body;
  const sub = submissions.find((s) => s.submissionID === submissionID);
  if (sub) {
    sub.grade = grade;
    sub.feedback = feedback;
    return res.json({ success: true });
  }
  res.status(404).json({ success: false });
});

app.post("/api/submit", (req, res) => {
  const { assignmentID } = req.body;
  submissions.push({
    submissionID: `SUB${Date.now()}`,
    assignmentID,
    studentID: student.studentID,
    status: "Completed",
    submissionDate: new Date().toISOString().split("T")[0],
  });
  res.json({ success: true });
});

app.post("/api/announce", (req, res) => {
  const { message } = req.body;
  console.log(`[BROADCAST] ${educator.name}: ${message}`);
  res.json({ success: true });
});

app.post("/api/create-assignment", (req, res) => {
  const { title, dueDate, description, course } = req.body;
  assignments.push({
    assignmentID: `ASG00${assignments.length + 1}`,
    authorID: educator.educatorID,
    title,
    course,
    dueDate,
    description,
  });
  res.status(201).json({ success: true });
});

// Render the new Landing Page at the root URL
app.get('/', (req, res) => {
    res.render('home');
});app.listen(3000, () => console.log("SMS Live: http://localhost:3000"));
