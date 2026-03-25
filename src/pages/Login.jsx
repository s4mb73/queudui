import { useState } from "react";

export default function Login({ signIn, resetPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [mode, setMode] = useState("login"); // "login" | "reset"

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Enter your email and password");
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message === "Invalid login credentials"
        ? "Incorrect email or password"
        : err.message);
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email) return setError("Enter your email");
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: "flex", height: "100vh", alignItems: "center", justifyContent: "center",
      background: "#f7f8fa", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: "#ffffff", borderRadius: 16, padding: "40px 36px",
        width: 380, maxWidth: "90vw",
        border: "0.5px solid #e2e6ea",
        boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <img src="/logo.png" alt="Queud" style={{ width: 32, height: 32, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1 }}>Queud</div>
            <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "1.5px", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>Inventory Manager</div>
          </div>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 20 }}>Sign in to your account</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", color: "#374151", marginBottom: 6, textTransform: "uppercase" }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" autoFocus
                style={{
                  background: "#f7f8fa", border: "1.5px solid #e2e6ea", color: "#0f172a",
                  fontFamily: "inherit", fontSize: 13, padding: "10px 13px", width: "100%",
                  borderRadius: 8, outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = "#1a3a6e"}
                onBlur={e => e.target.style.borderColor = "#e2e6ea"}
              />
            </div>

            <div style={{ marginBottom: 6 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", color: "#374151", marginBottom: 6, textTransform: "uppercase" }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password" autoComplete="current-password"
                style={{
                  background: "#f7f8fa", border: "1.5px solid #e2e6ea", color: "#0f172a",
                  fontFamily: "inherit", fontSize: 13, padding: "10px 13px", width: "100%",
                  borderRadius: 8, outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = "#1a3a6e"}
                onBlur={e => e.target.style.borderColor = "#e2e6ea"}
              />
            </div>

            <div style={{ textAlign: "right", marginBottom: 20 }}>
              <button type="button" onClick={() => { setMode("reset"); setError(null); }}
                style={{ background: "none", border: "none", color: "#1a3a6e", fontSize: 12, fontWeight: 500, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                Forgot password?
              </button>
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444", fontSize: 12, fontWeight: 500, padding: "10px 14px",
                borderRadius: 8, marginBottom: 16,
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", background: "#1a3a6e", color: "white", border: "none",
              borderRadius: 9, padding: "11px 20px", fontSize: 13, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: loading ? 0.7 : 1, transition: "all 0.15s",
              boxShadow: "0 1px 3px rgba(26,58,110,0.3)",
            }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Reset your password</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>We'll send you a link to reset your password.</div>

            {resetSent ? (
              <div style={{
                background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)",
                color: "#059669", fontSize: 12, fontWeight: 500, padding: "12px 14px",
                borderRadius: 8, marginBottom: 16,
              }}>Check your email for the reset link.</div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", color: "#374151", marginBottom: 6, textTransform: "uppercase" }}>Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email" autoFocus
                    style={{
                      background: "#f7f8fa", border: "1.5px solid #e2e6ea", color: "#0f172a",
                      fontFamily: "inherit", fontSize: 13, padding: "10px 13px", width: "100%",
                      borderRadius: 8, outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>

                {error && (
                  <div style={{
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                    color: "#ef4444", fontSize: 12, fontWeight: 500, padding: "10px 14px",
                    borderRadius: 8, marginBottom: 16,
                  }}>{error}</div>
                )}

                <button type="submit" disabled={loading} style={{
                  width: "100%", background: "#1a3a6e", color: "white", border: "none",
                  borderRadius: 9, padding: "11px 20px", fontSize: 13, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
                  opacity: loading ? 0.7 : 1,
                }}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </>
            )}

            <button type="button" onClick={() => { setMode("login"); setError(null); setResetSent(false); }}
              style={{
                width: "100%", background: "transparent", color: "#64748b",
                border: "1px solid #e2e6ea", borderRadius: 9, padding: "10px 20px",
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                marginTop: 10,
              }}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
