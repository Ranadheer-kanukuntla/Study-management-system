CREATE DATABASE IF NOT EXISTS studylink;
USE studylink;

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       ENUM('student','educator') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  student_id VARCHAR(20)  PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL UNIQUE,
  name       VARCHAR(255) NOT NULL,
  major      VARCHAR(255) NOT NULL DEFAULT 'Undeclared',
  gpa        DECIMAL(3,2) DEFAULT 0.00,
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS educators (
  educator_id VARCHAR(20)  PRIMARY KEY,
  user_email  VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  department  VARCHAR(255) NOT NULL,
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS classes (
  class_id    VARCHAR(20)  PRIMARY KEY,
  educator_id VARCHAR(20)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  subject     VARCHAR(255) NOT NULL,
  section     VARCHAR(100) DEFAULT '',
  description TEXT,
  class_code  VARCHAR(8)   NOT NULL UNIQUE,  
  cover_color VARCHAR(7)   DEFAULT '#1565C0', 
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (educator_id) REFERENCES educators(educator_id) ON DELETE CASCADE
);

-- Students enroll in classes
CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  class_id      VARCHAR(20) NOT NULL,
  student_id    VARCHAR(20) NOT NULL,
  enrolled_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id)   REFERENCES classes(class_id)   ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  UNIQUE KEY uq_enrollment (class_id, student_id)
);

-- Assignments belong to a class
CREATE TABLE IF NOT EXISTS assignments (
  assignment_id VARCHAR(30)  PRIMARY KEY,
  class_id      VARCHAR(20)  NOT NULL,
  author_id     VARCHAR(20)  NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  due_date      DATE         NOT NULL,
  points        INT          DEFAULT 100,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id)  REFERENCES classes(class_id)     ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES educators(educator_id) ON DELETE CASCADE
);

-- Submissions by enrolled students
CREATE TABLE IF NOT EXISTS submissions (
  submission_id   VARCHAR(30)  PRIMARY KEY,
  assignment_id   VARCHAR(30)  NOT NULL,
  student_id      VARCHAR(20)  NOT NULL,
  status          ENUM('Assigned','Turned In','Returned') DEFAULT 'Assigned',
  grade           VARCHAR(5)   DEFAULT NULL,
  feedback        TEXT         DEFAULT NULL,
  file_path       VARCHAR(512) DEFAULT NULL,
  turned_in_at    TIMESTAMP    DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)    REFERENCES students(student_id)        ON DELETE CASCADE,
  UNIQUE KEY uq_submission (student_id, assignment_id)
);

-- Class-level announcements
CREATE TABLE IF NOT EXISTS announcements (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  class_id    VARCHAR(20)  NOT NULL,
  educator_id VARCHAR(20)  NOT NULL,
  message     TEXT         NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id)    REFERENCES classes(class_id)     ON DELETE CASCADE,
  FOREIGN KEY (educator_id) REFERENCES educators(educator_id) ON DELETE CASCADE
);
