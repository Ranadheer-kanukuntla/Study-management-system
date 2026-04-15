const users = [
    { email: "ananya@university.com", password: "password123", role: "student" },
    { email: "ravi@university.com", password: "password456", role: "educator" }
];

const student = {
    studentID: "A00086685",
    name: "Ananya Sharma",
    major: "Computer Science",
    gpa: "3.82"
};

const educator = {
    educatorID: "ED001",
    name: "Prof. Ravi Kumar",
    department: "Computer Science"
};

const assignments = [
    { 
        assignmentID: "ASG001", 
        authorID: "ED001", // Prof. Ravi
        title: "CS101: Algorithms Quiz", 
        course: "Computer Science", 
        dueDate: "2026-03-15",
        description: "Focuses on Big O notation and sorting algorithms."
    },
    { 
        assignmentID: "ASG002", 
        authorID: "ED001", // Prof. Ravi
        title: "CS102: Data Structures Lab", 
        course: "Computer Science", 
        dueDate: "2026-03-22",
        description: "Implement a Linked List and a Binary Search Tree."
    },
    { 
        assignmentID: "ASG003", 
        authorID: "ED002", // Different Professor
        title: "Ethics in AI Research Paper", 
        course: "Philosophy", 
        dueDate: "2026-03-18",
        description: "Write a 2000-word paper on the trolley problem."
    }
];

const submissions = [
    {
        submissionID: "SUB001",
        assignmentID: "ASG001",
        studentID: "A00086685", // Ananya
        status: "Completed",
        grade: "A",
        feedback: "Excellent Big O analysis.",
        submissionDate: "2026-03-10"
    },
    {
        submissionID: "SUB002",
        assignmentID: "ASG001",
        studentID: "A00076167", // Neeraj
        status: "Completed",
        grade: "B+",
        feedback: "Good logic, but check space complexity.",
        submissionDate: "2026-03-11"
    }
];

module.exports = { users, student, educator, assignments, submissions };