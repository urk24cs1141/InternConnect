
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// -------------------- DATABASE --------------------

const internshipSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, default: "Not specified" },
    description: { type: String, default: "" },
    duration: { type: String, default: "" },
    stipend: { type: String, default: "" },
    skills: { type: String, default: "" },
  },
  { timestamps: true }
);

const Internship = mongoose.model("Internship", internshipSchema);

const applicationSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    course: { type: String, required: true },
    resumeUrl: { type: String, default: "" },
    internship: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Internship",
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Shortlisted", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

const Application = mongoose.model("Application", applicationSchema);

// -------------------- ADMIN AUTHENTICATION --------------------

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Admin login required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired login. Please log in again.",
    });
  }
}

// -------------------- BASIC ROUTES --------------------

app.get("/", (req, res) => {
  res.json({ message: "InternConnect API is running" });
});

// -------------------- ADMIN LOGIN --------------------

app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (
    email !== process.env.ADMIN_EMAIL ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign(
    { role: "admin", email },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ message: "Login successful", token });
});

// -------------------- VIEW INTERNSHIPS --------------------

app.get("/api/internships", async (req, res) => {
  try {
    const internships = await Internship.find().sort({ createdAt: -1 });
    res.json(internships);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch internships" });
  }
});

// -------------------- ADD INTERNSHIP (ADMIN) --------------------

app.post("/api/internships", requireAdmin, async (req, res) => {
  try {
    const { title, company } = req.body;

    if (!title || !company) {
      return res.status(400).json({
        message: "Internship title and company are required",
      });
    }

    const internship = await Internship.create(req.body);

    res.status(201).json({
      message: "Internship added successfully",
      internship,
    });
  } catch (error) {
    console.error("Add internship error:", error.message);
    res.status(500).json({ message: "Failed to add internship" });
  }
});

// -------------------- SUBMIT APPLICATION --------------------

app.post("/api/applications", async (req, res) => {
  try {
    const {
      studentName,
      email,
      phone,
      course,
      resumeUrl,
      internshipId,
    } = req.body;

    // Validate the fields sent by the frontend.
    if (
      typeof studentName !== "string" ||
      !studentName.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof course !== "string" ||
      !course.trim() ||
      !internshipId
    ) {
      return res.status(400).json({
        message: "Please complete all required fields",
      });
    }

    // Validate the selected internship ID.
    if (!mongoose.isValidObjectId(internshipId)) {
      return res.status(400).json({
        message: "Invalid internship ID",
      });
    }

    // Confirm that the selected internship exists.
    const internshipExists = await Internship.findById(internshipId);

    if (!internshipExists) {
      return res.status(404).json({
        message: "Internship not found",
      });
    }

    // Save the application using the schema's internship field.
    const application = await Application.create({
      studentName: studentName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      course: course.trim(),
      resumeUrl: typeof resumeUrl === "string" ? resumeUrl.trim() : "",
      internship: internshipId,
      status: "Pending",
    });

    res.status(201).json({
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("Application submission error:", error);

    res.status(500).json({
      message: "Failed to submit application",
    });
  }
});

// -------------------- STUDENT: CHECK APPLICATION STATUS --------------------

app.get("/api/my-applications", async (req, res) => {
  try {
    const email = req.query.email;

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "Please enter your email address",
      });
    }

    const applications = await Application.find({
      email: email.trim().toLowerCase(),
    })
      .populate("internship", "title company")
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error("Fetch student applications error:", error.message);

    res.status(500).json({
      message: "Failed to fetch application status",
    });
  }
});

// -------------------- ADMIN: VIEW ALL APPLICATIONS --------------------

app.get("/api/applications", requireAdmin, async (req, res) => {
  try {
    const applications = await Application.find()
      .populate("internship", "title company")
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error("Fetch applications error:", error.message);

    res.status(500).json({
      message: "Failed to fetch applications",
    });
  }
});

// -------------------- ADMIN: UPDATE APPLICATION STATUS --------------------

app.patch("/api/applications/:id/status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid application ID",
      });
    }

    const allowedStatuses = ["Pending", "Shortlisted", "Rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid application status",
      });
    }

    const application = await Application.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).populate("internship", "title company");

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    res.json({
      message: "Application status updated successfully",
      application,
    });
  } catch (error) {
    console.error("Update application status error:", error.message);

    res.status(500).json({
      message: "Failed to update application status",
    });
  }
});

// -------------------- START SERVER --------------------

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });
