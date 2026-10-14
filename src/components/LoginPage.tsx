import { FormEvent, useState } from "react";
import {
  LockKeyhole,
  ShieldCheck,
  Mail,
} from "lucide-react";

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
}

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Vui lòng nhập email.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setError("Email không hợp lệ.");
      return;
    }

    if (!password) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }

    setLoading(true);

    try {
      await onLogin(cleanEmail, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Email hoặc mật khẩu không đúng."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* BRAND */}
        <div className="login-brand">
          <img
            className="app-logo"
            src="/app-logo.svg"
            alt="Smart Building"
          />

          <div>
            <strong>Smart Building</strong>
            <span>Access System</span>
          </div>
        </div>

        {/* TITLE */}
        <div className="login-title">
          <h1>Đăng nhập</h1>

          <p>
            Đăng nhập để quản lý và sử dụng
            hệ thống khóa cửa thông minh.
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={submit}>

          {/* EMAIL */}
          <label htmlFor="email">
            Email
          </label>

          <div className="login-input">
            <Mail size={18} />

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email"
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          {/* PASSWORD */}
          <label htmlFor="password">
            Mật khẩu
          </label>

          <div className="login-input">
            <LockKeyhole size={18} />

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {/* ERROR */}
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          {/* LOGIN BUTTON */}
          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        {/* SECURITY MESSAGE */}
        <div className="login-security">
          <ShieldCheck size={16} />

          <span>
            Tài khoản được cấp bởi quản trị viên
            hệ thống
          </span>
        </div>

      </div>
    </div>
  );
}