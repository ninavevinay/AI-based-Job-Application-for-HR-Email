import { useEffect, useState } from "react";
import { endpoints, instance } from "./api";
import { Toaster, toast } from "sonner";
import { 
  Zap, 
  LogOut, 
  Mail, 
  Lock, 
  User, 
  FileText, 
  Briefcase, 
  Send, 
  Sparkles,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";

const TOKEN_KEY = "ai_job_application_token";

const emptyAuthForm = {
  name: "",
  email: "",
  password: "",
};

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [currentUser, setCurrentUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);

  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [jobPosition, setJobPosition] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [application, setApplication] = useState({
    subject: "",
    body: "",
  });

  useEffect(() => {
    const loadSession = async () => {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setBooting(false);
        return;
      }

      try {
        const res = await instance.get(endpoints.ME);
        setCurrentUser(res.data.user);
        setFromEmail(res.data.user.email || "");
      } catch (sessionError) {
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setBooting(false);
      }
    };

    loadSession();
  }, []);

  useEffect(() => {
    if (currentUser?.email && !fromEmail) {
      setFromEmail(currentUser.email);
    }
  }, [currentUser, fromEmail]);

  const readError = (err, fallback) =>
    err.response?.data?.detail ||
    err.response?.data?.message ||
    fallback ||
    "Something went wrong";

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      const endpoint =
        authMode === "login" ? endpoints.LOGIN : endpoints.REGISTER;
      const payload =
        authMode === "login"
          ? {
              email: authForm.email,
              password: authForm.password,
            }
          : {
              name: authForm.name,
              email: authForm.email,
              password: authForm.password,
            };

      const res = await instance.post(endpoint, payload);

      localStorage.setItem(TOKEN_KEY, res.data.token);
      setCurrentUser(res.data.user);
      setFromEmail(res.data.user.email || "");
      toast.success(
        authMode === "login"
          ? `Welcome back, ${res.data.user.name}! 👋`
          : `Account created for ${res.data.user.name}! 🎉`
      );
      setAuthForm(emptyAuthForm);
    } catch (err) {
      toast.error(readError(err, "Authentication failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await instance.post(endpoints.LOGOUT);
    } catch (err) {
      // Clear local state even if the server session has already expired.
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setCurrentUser(null);
      setResumeFile(null);
      setResumeText("");
      setJobPosition("");
      setJobDescription("");
      setFromEmail("");
      setToEmail("");
      setApplication({
        subject: "",
        body: "",
      });
      toast.info("You have been signed out.");
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setResumeFile(file);
    setBusy(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await instance.post(endpoints.UPLOAD_RESUME, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setResumeText(res.data.resume_text || "");
      toast.success("Resume uploaded and parsed successfully! 📄");
    } catch (err) {
      toast.error(readError(err, "Resume upload failed"));
    } finally {
      setBusy(false);
    }
  };

  const generateApplication = async () => {
    if (!resumeText) {
      toast.error("Please upload a PDF resume first.");
      return;
    }

    if (!jobPosition || !jobDescription || !fromEmail || !toEmail) {
      toast.error(
        "Please fill in job position, job description, from email, and HR email."
      );
      return;
    }

    setBusy(true);

    try {
      const res = await instance.post(endpoints.GENERATE_APPLICATION, {
        resume_text: resumeText,
        job_position: jobPosition,
        job_description: jobDescription,
        from_email: fromEmail,
        to_email: toEmail,
        candidate_name: currentUser?.name || "",
      });

      setApplication({
        subject: res.data.subject || "",
        body: res.data.body || "",
      });
      toast.success("Application draft generated! ✨");
    } catch (err) {
      toast.error(readError(err, "Failed to generate application"));
    } finally {
      setBusy(false);
    }
  };

  const sendApplication = async () => {
    if (!resumeFile) {
      toast.error("Please upload the resume PDF before sending the email.");
      return;
    }

    if (!fromEmail || !toEmail || !application.subject || !application.body) {
      toast.error(
        "Enter the From Email, generate the application, and fill the HR email before sending."
      );
      return;
    }

    setBusy(true);

    const formData = new FormData();
    formData.append("to", toEmail);
    formData.append("subject", application.subject);
    formData.append("body", application.body);
    formData.append("from_email", fromEmail);
    formData.append("resume", resumeFile);

    try {
      await instance.post(endpoints.SEND_EMAIL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Application email sent successfully! 📨");
    } catch (err) {
      toast.error(readError(err, "Email sending failed"));
    } finally {
      setBusy(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-3xl opacity-20 animate-pulse"></div>
          <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-12 text-center border border-white/50 max-w-md w-full">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              AI Job Studio
            </h1>
            <p className="text-slate-500 mb-6">Intelligent application generator</p>
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Checking your session...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          style: {
            background: 'white',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.15)',
            borderRadius: '16px',
            padding: '16px',
          },
          className: 'font-sans'
        }}
      />
      
      <div className="max-w-7xl mx-auto px-4 py-8 md:px-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                AI Job Studio
              </h1>
              <p className="text-sm text-slate-500">Intelligent application generator</p>
            </div>
          </div>
          
          {currentUser && (
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm px-5 py-3 rounded-2xl border border-white/50 shadow-lg shadow-black/5 w-full md:w-auto">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                {currentUser.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </header>

        {!currentUser ? (
          /* Auth Card */
          <div className="max-w-md mx-auto">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">
                  {authMode === "login" ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  {authMode === "login" 
                    ? "Sign in to continue your journey" 
                    : "Start your AI-powered job application"}
                </p>
              </div>

              <div className="flex bg-slate-100 rounded-2xl p-1 mb-6">
                <button
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    authMode === "login" 
                      ? "bg-white shadow-md text-slate-800" 
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    authMode === "register" 
                      ? "bg-white shadow-md text-slate-800" 
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setAuthMode("register")}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === "register" && (
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={authForm.name}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, name: e.target.value })
                      }
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="Your name"
                      required
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, email: e.target.value })
                    }
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, password: e.target.value })
                    }
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Working...
                    </>
                  ) : (
                    <>
                      {authMode === "login" ? "Login" : "Create account"}
                      {authMode === "login" ? "→" : "→"}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 1 Panel */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200/50">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/25">
                  1
                </div>
                <div>
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Step 1</p>
                  <h2 className="text-xl font-bold text-slate-800">Resume & Job Details</h2>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    PDF Resume
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      className="w-full px-4 py-3.5 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold hover:file:bg-indigo-100"
                    />
                  </div>
                  {resumeFile ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-2 rounded-xl">
                      <CheckCircle className="w-4 h-4" />
                      {resumeFile.name}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">Upload a PDF to extract text</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <Briefcase className="w-4 h-4 text-indigo-500" />
                    Job Position
                  </label>
                  <input
                    type="text"
                    value={jobPosition}
                    onChange={(e) => setJobPosition(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="e.g., Frontend Developer"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Job Description
                  </label>
                  <textarea
                    rows="4"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                    placeholder="Paste the full job description here..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                      <Mail className="w-4 h-4 text-indigo-500" />
                      From Email
                    </label>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                      <Send className="w-4 h-4 text-indigo-500" />
                      HR Email
                    </label>
                    <input
                      type="email"
                      value={toEmail}
                      onChange={(e) => setToEmail(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="hr@company.com"
                    />
                  </div>
                </div>

                <button
                  onClick={generateApplication}
                  disabled={busy}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Application
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step 2 Panel */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200/50">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/25">
                  2
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Step 2</p>
                  <h2 className="text-xl font-bold text-slate-800">Review & Send</h2>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-emerald-500" />
                    Subject
                  </label>
                  <input
                    type="text"
                    value={application.subject}
                    onChange={(e) =>
                      setApplication({ ...application, subject: e.target.value })
                    }
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="Application for..."
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    Application Body
                  </label>
                  <textarea
                    rows="8"
                    value={application.body}
                    onChange={(e) =>
                      setApplication({ ...application, body: e.target.value })
                    }
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                    placeholder="Your generated application will appear here..."
                  />
                </div>

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-200/50">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-800">From Email</span> is used as the reply-to address and signature in the drafted application.
                    </p>
                  </div>
                </div>

                <button
                  onClick={sendApplication}
                  disabled={busy}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Application Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;