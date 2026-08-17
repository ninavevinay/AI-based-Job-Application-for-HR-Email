import { useEffect, useState } from "react";
import { endpoints, instance } from "./api";
import { Toaster, toast } from "sonner";
import { GoogleLogin } from "@react-oauth/google";
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
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  History,
  Settings,
  Trash2,
  UserCircle,
  Edit3,
  Save,
  LockKeyhole,
  X,
  Calendar,
  KeyRound,
  CheckSquare
} from "lucide-react";

const TOKEN_KEY = "ai_job_application_token";

const emptyAuthForm = {
  name: "",
  email: "",
  password: "",
};

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [currentUser, setCurrentUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // UI State for Modals & Drawers
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGoogleInfoModal, setShowGoogleInfoModal] = useState(false);
  
  // Data State
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  
  // Profile Editing State
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;


  useEffect(() => {
    const handleAuthExpired = () => {
      setCurrentUser(null);
      setStats(null);
      setApplications([]);
      toast.error("Your secure session expired. Please log in again.", { icon: "🔒" });
    };
    window.addEventListener("auth_token_expired", handleAuthExpired);
    return () => window.removeEventListener("auth_token_expired", handleAuthExpired);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await instance.get(endpoints.STATS);
      setStats(res.data.stats);
    } catch (err) {
      console.warn("Failed to fetch stats");
    }
  };

  const fetchApplications = async () => {
    setFetchingHistory(true);
    try {
      const res = await instance.get(endpoints.APPLICATIONS);
      setApplications(res.data.applications || []);
    } catch (err) {
      toast.error("Failed to load application history.");
    } finally {
      setFetchingHistory(false);
    }
  };

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
        if (res.data.stats) {
          setStats(res.data.stats);
        } else {
          fetchStats();
        }
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
          : `Account created for ${res.data.user.name}! Welcome email sent to ${res.data.user.email} 🎉`
      );
      setAuthForm(emptyAuthForm);
    } catch (err) {
      toast.error(readError(err, "Authentication failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error("Google sign-in did not return a valid credential.");
      return;
    }

    setBusy(true);
    try {
      const res = await instance.post(endpoints.GOOGLE_AUTH, {
        credential: credentialResponse.credential,
      });

      localStorage.setItem(TOKEN_KEY, res.data.token);
      setCurrentUser(res.data.user);
      setFromEmail(res.data.user.email || "");

      if (res.data.is_new_user) {
        toast.success(
          `Welcome to AI Job Studio, ${res.data.user.name}! A welcome email was sent to ${res.data.user.email} 🎉`
        );
      } else {
        toast.success(`Welcome back, ${res.data.user.name}! 👋`);
      }
    } catch (err) {
      toast.error(readError(err, "Google Authentication failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleError = () => {
    toast.error("Google Sign-In failed or was cancelled.");
  };

  const handleLogout = async () => {
    try {
      await instance.post(endpoints.LOGOUT);
    } catch (err) {
      // Clear local state even if server session expired
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

  const copyToClipboard = () => {
    const fullText = `Subject: ${application.subject}\n\n${application.body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Application copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
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
      const res = await instance.post(endpoints.SEND_EMAIL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(
        res.data.message ||
          `Application sent to ${toEmail} and confirmation copy sent to your email (${currentUser?.email})! 📨`
      );
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
              <p className="text-sm text-slate-500">PostgreSQL Powered • Google OAuth • Smart Applications</p>
            </div>
          </div>
          
          {currentUser && (
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm px-5 py-3 rounded-2xl border border-white/50 shadow-lg shadow-black/5 w-full md:w-auto">
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-full border border-indigo-200 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                  {currentUser.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 truncate">{currentUser.name}</p>
                  {currentUser.auth_provider === "google" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                      Google
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 gap-1">
                      <LockKeyhole className="w-3 h-3" />
                      JWT
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
              </div>
              
              <div className="flex items-center gap-1 border-l border-slate-200 pl-4 ml-2">
                <button
                  onClick={() => {
                    fetchApplications();
                    setShowHistory(true);
                  }}
                  title="Application History"
                  className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all relative"
                >
                  <History className="w-5 h-5" />
                  {stats && stats.total_applications_sent > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-pink-500 rounded-full animate-pulse"></span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setProfileForm({ name: currentUser.name || "" });
                    setShowProfile(true);
                  }}
                  title="Profile Settings"
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </header>

        {!currentUser ? (
          /* Auth Card */
          <div className="max-w-md mx-auto">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">
                  {authMode === "login" ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  {authMode === "login" 
                    ? "Sign in to generate tailored job applications" 
                    : "Join with Google or email to get started"}
                </p>
              </div>

              {/* Google OAuth Section */}
              <div className="mb-6">
                {googleClientId ? (
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      theme="outline"
                      size="large"
                      shape="pill"
                      text="continue_with"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                         onClick={() => setShowGoogleInfoModal(true)}>
                      <GoogleIcon />
                      <span className="text-sm font-medium text-slate-700">Continue with Google</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative flex items-center justify-center mb-6">
                <div className="border-t border-slate-200 w-full"></div>
                <span className="bg-white/80 px-3 text-xs font-semibold uppercase text-slate-400">
                  Or continue with email
                </span>
                <div className="border-t border-slate-200 w-full"></div>
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
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-800"
                      placeholder="Your Full Name"
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
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-800"
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
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-800"
                    placeholder="Password (min 6 characters)"
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
                      Processing...
                    </>
                  ) : (
                    <>
                      {authMode === "login" ? "Sign In" : "Create Account & Send Welcome Mail"}
                      <span>→</span>
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
                  <h2 className="text-xl font-bold text-slate-800">Resume & Target Position</h2>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Upload PDF Resume
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
                    <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                      <CheckCircle className="w-4 h-4" />
                      <span>{resumeFile.name}</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">PDF text will be parsed for AI analysis</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <Briefcase className="w-4 h-4 text-indigo-500" />
                    Target Job Title / Position
                  </label>
                  <input
                    type="text"
                    value={jobPosition}
                    onChange={(e) => setJobPosition(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-800"
                    placeholder="e.g., Senior Full Stack Engineer"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Job Description / Requirements
                  </label>
                  <textarea
                    rows="4"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-slate-800"
                    placeholder="Paste the key job description, responsibilities, and qualifications..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                      <Mail className="w-4 h-4 text-indigo-500" />
                      Your Email (Applicant)
                    </label>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-800"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                      <Send className="w-4 h-4 text-indigo-500" />
                      HR / Recruiter Email
                    </label>
                    <input
                      type="email"
                      value={toEmail}
                      onChange={(e) => setToEmail(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-800"
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
                      Generating Application...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate AI Application Draft
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step 2 Panel */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/25">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Step 2</p>
                    <h2 className="text-xl font-bold text-slate-800">Review & Send Email</h2>
                  </div>
                </div>

                {application.body && (
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy Draft"}
                  </button>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-emerald-500" />
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={application.subject}
                    onChange={(e) =>
                      setApplication({ ...application, subject: e.target.value })
                    }
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-slate-800 font-medium"
                    placeholder="Application for [Role] - [Your Name]"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    Application Cover Letter Body
                  </label>
                  <textarea
                    rows="8"
                    value={application.body}
                    onChange={(e) =>
                      setApplication({ ...application, body: e.target.value })
                    }
                    className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none text-slate-800 leading-relaxed font-sans"
                    placeholder="Your generated application will appear here ready to edit..."
                  />
                </div>

                {/* Email Delivery Notice Banner */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 rounded-2xl p-4 border border-emerald-200/50">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>
                        <strong className="text-slate-800">Direct HR & Main User Delivery:</strong> When you click Send, the application and your PDF resume are sent directly to the HR email (<span className="font-mono text-slate-700">{toEmail || "HR Email"}</span>).
                      </p>
                      <p>
                        A confirmation copy is also sent to your registered email (<span className="font-mono text-slate-700">{currentUser?.email}</span>) with your attached resume.
                      </p>
                    </div>
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
                      Delivering Email & Attachment...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Application & Deliver Copy to Main Mailbox
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modals & Drawers */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <History className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Application History</h2>
                    <p className="text-sm text-slate-500">Your previously generated and sent applications</p>
                  </div>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                {fetchingHistory ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-400" />
                    <p>Loading your history...</p>
                  </div>
                ) : applications.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Briefcase className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-1">No applications yet</h3>
                    <p className="text-slate-500">Generate and send your first AI application to see it here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map(app => (
                      <div key={app.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-800 text-lg mb-1">{app.job_position}</h3>
                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mb-3">
                              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(app.created_at).toLocaleDateString()}</span>
                              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Sent to: {app.hr_email}</span>
                            </div>
                            <p className="text-sm text-slate-600 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">Subject: {app.subject}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setApplication({ subject: app.subject, body: app.body });
                                setShowHistory(false);
                                toast.success("Draft loaded into editor!");
                              }}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Reuse Draft
                            </button>
                            <button 
                              onClick={async () => {
                                if(confirm("Delete this log entry?")) {
                                  try {
                                    await instance.delete(endpoints.APPLICATIONS + "/" + app.id);
                                    setApplications(applications.filter(a => a.id !== app.id));
                                    toast.success("Log entry deleted");
                                    fetchStats();
                                  } catch (err) { toast.error("Failed to delete log"); }
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 text-sm text-slate-600 bg-slate-50/50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap max-h-40 overflow-y-auto font-sans leading-relaxed">
                          {app.body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Account Settings</h2>
                    <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-0.5"><LockKeyhole className="w-3 h-3"/> JWT Secured Session</p>
                  </div>
                </div>
                <button onClick={() => setShowProfile(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Display Name</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={profileForm.name} 
                      onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                    />
                    <button 
                      onClick={async () => {
                        try {
                          const res = await instance.put(endpoints.UPDATE_PROFILE, { name: profileForm.name });
                          setCurrentUser(res.data.user);
                          toast.success("Profile updated");
                        } catch (err) { toast.error("Update failed"); }
                      }}
                      className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold transition-all shadow-sm"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Email Address</label>
                  <input type="email" value={currentUser?.email || ""} disabled className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed" />
                  {currentUser?.auth_provider === "google" && <p className="text-xs text-blue-600 mt-1.5 font-medium flex items-center gap-1"><GoogleIcon/> Connected via Google OAuth</p>}
                </div>

                {currentUser?.auth_provider === "local" && (
                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5"/> Change Password</label>
                    <div className="space-y-3">
                      <input 
                        type="password" placeholder="Current Password" 
                        value={passwordForm.current_password} onChange={e => setPasswordForm({...passwordForm, current_password: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                      <input 
                        type="password" placeholder="New Password" 
                        value={passwordForm.new_password} onChange={e => setPasswordForm({...passwordForm, new_password: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                      <button 
                        onClick={async () => {
                          try {
                            await instance.put(endpoints.CHANGE_PASSWORD, passwordForm);
                            toast.success("Password changed successfully");
                            setPasswordForm({ current_password: "", new_password: "" });
                          } catch (err) { toast.error(err.response?.data?.detail || "Password update failed"); }
                        }}
                        className="w-full py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-semibold transition-all text-sm shadow-sm"
                      >
                        Update Password
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="bg-indigo-50 rounded-2xl p-4 flex items-center justify-between border border-indigo-100">
                   <div>
                     <p className="text-sm font-bold text-indigo-900">Total Applications Sent</p>
                     <p className="text-xs text-indigo-600 mt-0.5">Powered by AI Job Studio</p>
                   </div>
                   <div className="text-2xl font-black text-indigo-600">{stats?.total_applications_sent || 0}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showGoogleInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 p-8 text-center relative">
              <button onClick={() => setShowGoogleInfoModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all"><X className="w-5 h-5"/></button>
              
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <GoogleIcon />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Enable Google Login</h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                To use the live Google One-Tap authentication popup, you need to add your <strong>Google Client ID</strong> to the environment file.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left mb-6 shadow-inner">
                <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2"><CheckSquare className="w-4 h-4 text-emerald-500"/> Quick Setup Guide</h3>
                <ol className="text-xs text-slate-600 space-y-2.5 list-decimal pl-4 font-medium">
                  <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-blue-600 hover:underline">Google Cloud Console</a>.</li>
                  <li>Create an <strong>OAuth Client ID</strong> (Web application).</li>
                  <li>Open <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">frontend/.env</code> in your editor.</li>
                  <li>Set <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">VITE_GOOGLE_CLIENT_ID</code> to your new Client ID.</li>
                  <li>Restart your frontend development server.</li>
                </ol>
              </div>
              
              <button onClick={() => setShowGoogleInfoModal(false)} className="w-full py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-semibold transition-all">
                Got it, thanks!
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
