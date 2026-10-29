
import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

function App() {
  const [search, setSearch] = useState("");
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [selectedInternship, setSelectedInternship] = useState(null);
  const [savingApplication, setSavingApplication] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState("");

  const [adminToken, setAdminToken] = useState(
    () => sessionStorage.getItem("internconnectAdminToken") || ""
  );
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginMessage, setAdminLoginMessage] = useState("");
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);

  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsMessage, setApplicationsMessage] = useState("");
  const [showApplications, setShowApplications] = useState(false);
  const [updatingApplicationId, setUpdatingApplicationId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Student My Applications
  const [studentEmail, setStudentEmail] = useState("");
  const [myApplications, setMyApplications] = useState([]);
  const [myApplicationsLoading, setMyApplicationsLoading] = useState(false);
  const [myApplicationsMessage, setMyApplicationsMessage] = useState("");
  const [showMyApplications, setShowMyApplications] = useState(false);

  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "Remote",
    duration: "3 Months",
    stipend: "Unpaid",
    type: "Technology",
    description: "",
  });

  const [applicationForm, setApplicationForm] = useState({
    studentName: "",
    email: "",
    phone: "",
    course: "",
    resumeUrl: "",
  });

  async function readResponse(response) {
    const responseText = await response.text();

    try {
      return responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(
        `Unexpected server response (HTTP ${response.status}). Check the backend.`
      );
    }
  }

  async function loadInternships() {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/internships`);
      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Could not load internships.");
      }

      setInternships(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadApplications(token = adminToken) {
    if (!token) {
      setShowAdminLogin(true);
      setAdminLoginMessage("Please log in as an admin to view applications.");
      return;
    }

    try {
      setApplicationsLoading(true);
      setApplicationsMessage("");

      const response = await fetch(`${API_URL}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("internconnectAdminToken");
        setAdminToken("");
        setApplications([]);
        setShowApplications(false);
        setShowAdminLogin(true);
        setAdminLoginMessage("Your login expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not load applications.");
      }

      setApplications(Array.isArray(data) ? data : []);
      setShowApplications(true);
      setShowAdminLogin(false);
    } catch (error) {
      setApplicationsMessage(error.message);
    } finally {
      setApplicationsLoading(false);
    }
  }

  // Student: find applications using the email entered during application
  async function handleMyApplications(event) {
    event.preventDefault();
    setMyApplicationsLoading(true);
    setMyApplicationsMessage("");
    setMyApplications([]);
    setShowMyApplications(true);

    try {
      const response = await fetch(
        `${API_URL}/my-applications?email=${encodeURIComponent(studentEmail.trim())}`
      );
      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Could not check application status.");
      }

      setMyApplications(Array.isArray(data) ? data : []);

      if (data.length === 0) {
        setMyApplicationsMessage(
          "No applications found for this email address. Check that you entered the same email used to apply."
        );
      }
    } catch (error) {
      setMyApplicationsMessage(error.message);
    } finally {
      setMyApplicationsLoading(false);
    }
  }

  useEffect(() => {
    loadInternships();
  }, []);

  async function handleAdminLogin(event) {
    event.preventDefault();
    setAdminLoginLoading(true);
    setAdminLoginMessage("");

    try {
      const response = await fetch(`${API_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Admin login failed.");
      }

      if (!data.token) {
        throw new Error("The server did not return a login token.");
      }

      sessionStorage.setItem("internconnectAdminToken", data.token);
      setAdminToken(data.token);
      setAdminPassword("");
      setAdminLoginMessage("Login successful!");
      await loadApplications(data.token);
    } catch (error) {
      setAdminLoginMessage(error.message);
    } finally {
      setAdminLoginLoading(false);
    }
  }

  function handleAdminLogout() {
    sessionStorage.removeItem("internconnectAdminToken");
    setAdminToken("");
    setApplications([]);
    setShowApplications(false);
    setShowAdminLogin(false);
    setAdminEmail("");
    setAdminPassword("");
    setAdminLoginMessage("You have logged out.");
    setApplicationsMessage("");
    setStatusMessage("");
    setMessage("");
  }

  function openAdminLogin(event) {
    event?.preventDefault();
    setShowAdminLogin(true);
    setShowApplications(false);
    setAdminLoginMessage("");

    setTimeout(() => {
      document.getElementById("admin-login")?.scrollIntoView({
        behavior: "smooth",
      });
    }, 100);
  }

  async function handleViewApplications(event) {
    event.preventDefault();

    if (!adminToken) {
      openAdminLogin();
      return;
    }

    setShowAdminLogin(false);
    setShowApplications(true);
    await loadApplications(adminToken);

    setTimeout(() => {
      document.getElementById("view-applications")?.scrollIntoView({
        behavior: "smooth",
      });
    }, 100);
  }

  async function handleStatusChange(applicationId, newStatus) {
    if (!adminToken) {
      openAdminLogin();
      return;
    }

    setUpdatingApplicationId(applicationId);
    setStatusMessage("");

    try {
      const response = await fetch(
        `${API_URL}/applications/${applicationId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("internconnectAdminToken");
        setAdminToken("");
        setApplications([]);
        setShowApplications(false);
        setShowAdminLogin(true);
        setAdminLoginMessage("Your login expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not update application status.");
      }

      setApplications((previous) =>
        previous.map((application) =>
          application._id === applicationId
            ? { ...application, status: data.application.status }
            : application
        )
      );

      setStatusMessage(`Status updated to ${data.application.status} successfully.`);
    } catch (error) {
      setStatusMessage(error.message);
      await loadApplications(adminToken);
    } finally {
      setUpdatingApplicationId("");
    }
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!adminToken) {
      setMessage("Please log in as an admin to add an internship.");
      openAdminLogin();
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/internships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(form),
      });

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("internconnectAdminToken");
        setAdminToken("");
        setApplications([]);
        setShowApplications(false);
        setMessage("Your admin login has expired. Please log in again.");
        openAdminLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not save the internship.");
      }

      // Add the returned internship object, not the whole response.
      setInternships((previous) => [data.internship || data, ...previous]);

      setForm({
        title: "",
        company: "",
        location: "Remote",
        duration: "3 Months",
        stipend: "Unpaid",
        type: "Technology",
        description: "",
      });

      setMessage("Internship saved successfully to MongoDB!");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleApplicationChange(event) {
    const { name, value } = event.target;
    setApplicationForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleApplicationSubmit(event) {
    event.preventDefault();

    if (!selectedInternship) {
      setApplicationMessage("Please select an internship first.");
      return;
    }

    setSavingApplication(true);
    setApplicationMessage("");

    try {
      const response = await fetch(`${API_URL}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...applicationForm,
          internshipId: selectedInternship._id,
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit application.");
      }

      setApplicationMessage(
        "Application submitted successfully! Your application has been saved."
      );

      // Remember the email so students can check their submitted applications.
      setStudentEmail(applicationForm.email);

      setApplicationForm({
        studentName: "",
        email: "",
        phone: "",
        course: "",
        resumeUrl: "",
      });

      if (showApplications && adminToken) {
        await loadApplications(adminToken);
      }
    } catch (error) {
      setApplicationMessage(error.message);
    } finally {
      setSavingApplication(false);
    }
  }

  function handleApply(internship) {
    setSelectedInternship(internship);
    setApplicationMessage("");

    setTimeout(() => {
      document.getElementById("student-application")?.scrollIntoView({
        behavior: "smooth",
      });
    }, 100);
  }

  const filteredInternships = internships.filter((internship) =>
    `${internship.title} ${internship.company} ${internship.location} ${internship.type}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="app">
      <header className="navbar">
        <h2 className="logo">
          Intern<span>Connect</span>
        </h2>

        <nav>
          <a href="#home">Home</a>
          <a href="#internships">Internships</a>
          <a href="#my-applications">My Applications</a>
          {adminToken && <a href="#add-internship">Add Internship</a>}
          <a href="#about">About</a>
          <a href="#view-applications" onClick={handleViewApplications}>
            View Applications
          </a>
        </nav>

        {adminToken ? (
          <button className="login-button" onClick={handleAdminLogout}>
            Admin Logout
          </button>
        ) : (
          <button className="login-button" onClick={openAdminLogin}>
            Admin Login
          </button>
        )}
      </header>

      <main>
        <section className="hero" id="home">
          <p className="tagline">YOUR CAREER STARTS HERE</p>
          <h1>
            Find Your Perfect <span>Internship</span>
          </h1>
          <p className="hero-text">
            Discover opportunities, gain real-world experience, and
            take the first step toward your dream career.
          </p>

          <div className="search-box">
            <input
              type="text"
              placeholder="Search by role, company, or location..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              onClick={() =>
                document.getElementById("internships")?.scrollIntoView({
                  behavior: "smooth",
                })
              }
            >
              Search
            </button>
          </div>

          <div className="hero-stats">
            <div>
              <strong>{internships.length}</strong>
              <span>Internships listed</span>
            </div>
            <div>
              <strong>Live</strong>
              <span>Database connection</span>
            </div>
            <div>
              <strong>Easy</strong>
              <span>Online applications</span>
            </div>
          </div>
        </section>

        {showAdminLogin && (
          <section className="add-internship-section" id="admin-login">
            <div className="section-heading">
              <p className="tagline">RESTRICTED ACCESS</p>
              <h2>Admin Login</h2>
              <p>Log in to manage internships and review applications.</p>
            </div>

            <form className="internship-form" onSubmit={handleAdminLogin}>
              <label htmlFor="adminEmail">Admin Email</label>
              <input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="Enter admin email"
                autoComplete="username"
                required
              />

              <label htmlFor="adminPassword">Password</label>
              <input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="Enter admin password"
                autoComplete="current-password"
                required
              />

              {adminLoginMessage && (
                <p className="status-message" role="status">
                  {adminLoginMessage}
                </p>
              )}

              <button
                type="submit"
                className="apply-button"
                disabled={adminLoginLoading}
              >
                {adminLoginLoading ? "Logging in..." : "Login"}
              </button>

              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setShowAdminLogin(false);
                  setAdminLoginMessage("");
                }}
              >
                Cancel
              </button>
            </form>
          </section>
        )}

        <section className="internships-section" id="internships">
          <div className="section-heading">
            <p className="tagline">EXPLORE OPPORTUNITIES</p>
            <h2>Available Internships</h2>
            <p>Find an opportunity that matches your interests.</p>
          </div>

          {loading && <p>Loading internships...</p>}
          {!loading && message && (
            <p className="status-message" role="status">{message}</p>
          )}
          {!loading && filteredInternships.length === 0 && (
            <p className="empty-message">No internships found. Try another search.</p>
          )}

          <div className="internship-grid">
            {filteredInternships.map((internship) => (
              <article className="internship-card" key={internship._id}>
                <span className="internship-type">{internship.type}</span>
                <h3>{internship.title}</h3>
                <p className="company-name">{internship.company}</p>
                <p>{internship.description}</p>
                <div className="internship-details">
                  <span>📍 {internship.location}</span>
                  <span>🕒 {internship.duration}</span>
                  <span>💰 {internship.stipend}</span>
                </div>
                <button
                  type="button"
                  className="apply-button"
                  onClick={() => handleApply(internship)}
                >
                  Apply Now
                </button>
              </article>
            ))}
          </div>
        </section>

        {selectedInternship && (
          <section className="application-section" id="student-application">
            <div className="section-heading">
              <p className="tagline">TAKE THE NEXT STEP</p>
              <h2>Student Application Form</h2>
              <p>
                Applying for: <strong>{selectedInternship.title}</strong>
              </p>
              <p className="application-company">{selectedInternship.company}</p>
            </div>

            <form className="internship-form" onSubmit={handleApplicationSubmit}>
              <label htmlFor="studentName">Full Name</label>
              <input
                id="studentName"
                type="text"
                name="studentName"
                placeholder="Enter your full name"
                value={applicationForm.studentName}
                onChange={handleApplicationChange}
                required
              />

              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email"
                value={applicationForm.email}
                onChange={handleApplicationChange}
                required
              />

              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                name="phone"
                placeholder="Enter your phone number"
                value={applicationForm.phone}
                onChange={handleApplicationChange}
                required
              />

              <label htmlFor="course">Course / Department</label>
              <input
                id="course"
                type="text"
                name="course"
                placeholder="Example: B.Tech Computer Science"
                value={applicationForm.course}
                onChange={handleApplicationChange}
                required
              />

              <label htmlFor="resumeUrl">Resume URL</label>
              <input
                id="resumeUrl"
                type="url"
                name="resumeUrl"
                placeholder="Paste your resume link here"
                value={applicationForm.resumeUrl}
                onChange={handleApplicationChange}
                required
              />

              <p className="resume-help">
                Upload your resume to Google Drive and paste its shareable link here.
                Make sure the intended reviewer can open the link.
              </p>

              {applicationMessage && (
                <p className="status-message" role="status">{applicationMessage}</p>
              )}

              <button
                type="submit"
                className="apply-button"
                disabled={savingApplication}
              >
                {savingApplication ? "Submitting..." : "Submit Application"}
              </button>

              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setSelectedInternship(null);
                  setApplicationMessage("");
                }}
              >
                Cancel
              </button>
            </form>
          </section>
        )}

        {/* Student-facing My Applications section */}
        <section className="internships-section" id="my-applications">
          <div className="section-heading">
            <p className="tagline">TRACK YOUR PROGRESS</p>
            <h2>My Applications</h2>
            <p>Enter the email address you used to apply to check your status.</p>
          </div>

          <form className="internship-form" onSubmit={handleMyApplications}>
            <label htmlFor="studentStatusEmail">Email Address</label>
            <input
              id="studentStatusEmail"
              type="email"
              placeholder="Enter the email you applied with"
              value={studentEmail}
              onChange={(event) => setStudentEmail(event.target.value)}
              required
            />

            <button
              type="submit"
              className="apply-button"
              disabled={myApplicationsLoading}
            >
              {myApplicationsLoading ? "Checking..." : "Check Application Status"}
            </button>
          </form>

          {showMyApplications && myApplicationsLoading && (
            <p>Loading your applications...</p>
          )}

          {showMyApplications && myApplicationsMessage && (
            <p className="status-message" role="status">
              {myApplicationsMessage}
            </p>
          )}

          {showMyApplications && myApplications.length > 0 && (
            <div className="internship-grid">
              {myApplications.map((application) => (
                <article className="internship-card" key={application._id}>
                  <h3>{application.internship?.title || "Internship"}</h3>
                  <p className="company-name">
                    {application.internship?.company || "Company not available"}
                  </p>
                  <p><strong>Applicant:</strong> {application.studentName}</p>
                  <p><strong>Applied on:</strong>{" "}
                    {application.createdAt
                      ? new Date(application.createdAt).toLocaleDateString()
                      : "Not available"}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className="internship-type">
                      {application.status || "Pending"}
                    </span>
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {adminToken && (
          <section className="add-internship-section" id="add-internship">
            <div className="section-heading">
              <p className="tagline">ADMINISTRATION</p>
              <h2>Add an Internship</h2>
              <p>Share a new internship opportunity with students.</p>
            </div>

            <form className="internship-form" onSubmit={handleSubmit}>
              <label htmlFor="title">Internship Title</label>
              <input
                id="title"
                type="text"
                name="title"
                placeholder="Example: Frontend Developer Intern"
                value={form.title}
                onChange={handleFormChange}
                required
              />

              <label htmlFor="company">Company Name</label>
              <input
                id="company"
                type="text"
                name="company"
                placeholder="Enter company name"
                value={form.company}
                onChange={handleFormChange}
                required
              />

              <label htmlFor="location">Location</label>
              <select id="location" name="location" value={form.location} onChange={handleFormChange}>
                <option value="Remote">Remote</option>
                <option value="On-site">On-site</option>
                <option value="Hybrid">Hybrid</option>
              </select>

              <label htmlFor="duration">Duration</label>
              <select id="duration" name="duration" value={form.duration} onChange={handleFormChange}>
                <option value="1 Month">1 Month</option>
                <option value="2 Months">2 Months</option>
                <option value="3 Months">3 Months</option>
                <option value="6 Months">6 Months</option>
              </select>

              <label htmlFor="stipend">Stipend</label>
              <select id="stipend" name="stipend" value={form.stipend} onChange={handleFormChange}>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
              </select>

              <label htmlFor="type">Category</label>
              <select id="type" name="type" value={form.type} onChange={handleFormChange}>
                <option value="Technology">Technology</option>
                <option value="Design">Design</option>
                <option value="Marketing">Marketing</option>
                <option value="Business">Business</option>
                <option value="Other">Other</option>
              </select>

              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                placeholder="Describe the internship..."
                value={form.description}
                onChange={handleFormChange}
                rows="4"
              />

              {message && <p className="status-message" role="status">{message}</p>}

              <button type="submit" className="apply-button" disabled={saving}>
                {saving ? "Saving..." : "Add Internship"}
              </button>
            </form>
          </section>
        )}

        {showApplications && adminToken && (
          <section className="internships-section" id="view-applications">
            <div className="section-heading">
              <p className="tagline">ADMINISTRATION</p>
              <h2>Submitted Applications</h2>
              <p>Review applications and update their status.</p>
            </div>

            {applicationsLoading && <p>Loading applications...</p>}
            {applicationsMessage && (
              <p className="status-message" role="status">{applicationsMessage}</p>
            )}
            {statusMessage && (
              <p className="status-message" role="status">{statusMessage}</p>
            )}

            {!applicationsLoading && !applicationsMessage && applications.length === 0 && (
              <p className="empty-message">No applications found.</p>
            )}

            <div className="internship-grid">
              {applications.map((application) => (
                <article className="internship-card" key={application._id}>
                  <h3>{application.studentName}</h3>
                  <p><strong>Email:</strong> {application.email}</p>
                  <p><strong>Phone:</strong> {application.phone}</p>
                  <p><strong>Course:</strong> {application.course}</p>
                  <p><strong>Internship:</strong> {application.internship?.title || "Not available"}</p>
                  <p><strong>Company:</strong> {application.internship?.company || "Not available"}</p>
                  <p>
                    <strong>Resume:</strong>{" "}
                    <a href={application.resumeUrl} target="_blank" rel="noreferrer">
                      View Resume
                    </a>
                  </p>
                  <p>
                    <strong>Applied on:</strong>{" "}
                    {application.createdAt
                      ? new Date(application.createdAt).toLocaleDateString()
                      : "Not available"}
                  </p>

                  <label htmlFor={`status-${application._id}`}>
                    <strong>Application Status</strong>
                  </label>
                  <select
                    id={`status-${application._id}`}
                    value={application.status || "Pending"}
                    disabled={updatingApplicationId === application._id}
                    onChange={(event) =>
                      handleStatusChange(application._id, event.target.value)
                    }
                  >
                    <option value="Pending">Pending</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  {updatingApplicationId === application._id && <p>Updating status...</p>}
                </article>
              ))}
            </div>

            <button
              type="button"
              className="apply-button"
              onClick={() => loadApplications(adminToken)}
              disabled={applicationsLoading}
            >
              {applicationsLoading ? "Refreshing..." : "Refresh Applications"}
            </button>
            <button type="button" className="cancel-button" onClick={handleAdminLogout}>
              Logout
            </button>
          </section>
        )}

        <section className="about-section" id="about">
          <div className="section-heading">
            <p className="tagline">ABOUT US</p>
            <h2>About InternConnect</h2>
            <p>
              InternConnect helps students discover internship opportunities
              and submit applications online. Internship listings and applications
              are stored in MongoDB through our backend API.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} InternConnect. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
