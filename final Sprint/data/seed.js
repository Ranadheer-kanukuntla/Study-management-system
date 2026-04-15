require("dotenv").config({ override: true });
const bcryptjs     = require("bcryptjs");
const { execSync } = require("child_process");

const CONTAINER = "studylink_mysql";
const DB_USER   = process.env.DB_USER     || "studylink_user";
const DB_PASS   = process.env.DB_PASSWORD || "studylink_pass";
const DB_NAME   = process.env.DB_NAME     || "studylink";

async function seed() {
  console.log("\n Seeding StudyLink ...\n");
  const [h1, h2, h3, h4] = await Promise.all([
    bcryptjs.hash("password123", 10),
    bcryptjs.hash("password456", 10),
    bcryptjs.hash("password789", 10),
    bcryptjs.hash("password321", 10),
  ]);

  const sql = `
SET NAMES utf8mb4;
INSERT IGNORE INTO users (email,password,role) VALUES
  ('ananya@university.com','${h1}','student'),
  ('neeraj@university.com','${h3}','student'),
  ('priya@university.com', '${h4}','student'),
  ('ravi@university.com',  '${h2}','educator');

INSERT IGNORE INTO students (student_id,user_email,name,major,gpa) VALUES
  ('A00086685','ananya@university.com','Ananya Sharma','Computer Science',3.82),
  ('A00076167','neeraj@university.com','Neeraj Patel', 'Computer Science',3.55),
  ('A00091234','priya@university.com', 'Priya Mehta',  'Philosophy',3.71);

INSERT IGNORE INTO educators (educator_id,user_email,name,department) VALUES
  ('ED001','ravi@university.com','Prof. Ravi Kumar','Computer Science');

INSERT IGNORE INTO classes (class_id,educator_id,name,subject,section,description,class_code,cover_color) VALUES
  ('CLS001','ED001','Data Structures & Algorithms','Computer Science','Section A','Core CS concepts including arrays, trees, graphs and algorithm design.','CS-DSA1','#1565C0'),
  ('CLS002','ED001','Ethics in Technology','Philosophy','Section B','Exploring moral dimensions of AI, privacy, and digital rights.','ETH-T2','#2E7D32');

INSERT IGNORE INTO enrollments (class_id,student_id) VALUES
  ('CLS001','A00086685'),
  ('CLS001','A00076167'),
  ('CLS002','A00086685'),
  ('CLS002','A00091234');

INSERT IGNORE INTO assignments (assignment_id,class_id,author_id,title,description,due_date,points) VALUES
  ('ASG001','CLS001','ED001','Week 3: Big O Quiz','Solve 10 problems on time and space complexity. Show your working.',  '2026-04-15',100),
  ('ASG002','CLS001','ED001','Lab: Linked List Implementation','Build a doubly linked list with insert, delete, and reverse methods.','2026-04-22',100),
  ('ASG003','CLS002','ED001','Research Paper: Trolley Problem','Write a 2000-word paper exploring AI ethics through the trolley problem.','2026-04-18',100);

INSERT IGNORE INTO submissions (submission_id,assignment_id,student_id,status,grade,feedback,turned_in_at) VALUES
  ('SUB001','ASG001','A00086685','Returned','92','Excellent analysis of time complexity. Minor gap in space complexity.', NOW()),
  ('SUB002','ASG001','A00076167','Returned','78','Good attempt but the merge sort analysis needs revisiting.',NOW());
`;

  try {
    execSync(`docker exec -i ${CONTAINER} mysql -u${DB_USER} -p${DB_PASS} ${DB_NAME}`,
      { input: sql, stdio: ["pipe","inherit","inherit"] });
    console.log(" Seed complete!\n");
    console.log("   ravi@university.com    /  password456  (educator)");
    console.log("   ananya@university.com  /  password123  (student — enrolled in CLS001 + CLS002)");
    console.log("   neeraj@university.com  /  password789  (student — enrolled in CLS001)");
    console.log("   priya@university.com   /  password321  (student — enrolled in CLS002)\n");
    console.log("   Join codes:  CS-DSA1  (Data Structures)   ETH-T2  (Ethics)\n");
  } catch (err) {
    console.error("  Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
