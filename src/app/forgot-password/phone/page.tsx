"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fetchWithCsrf } from "@/lib/csrf";

// Validation schemas
const phoneSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码"),
});

const codeSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码"),
  code: z.string().regex(/^\d{6}$/, "验证码必须是6位数字"),
});

const passwordSchema = z.object({
  token: z.string().min(1, "缺少验证令牌"),
  newPassword: z.string()
    .min(6, "密码至少需要6个字符")
    .max(100, "密码不能超过100个字符"),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

type PhoneFormData = z.infer<typeof phoneSchema>;
type CodeFormData = z.infer<typeof codeSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

type Step = "phone" | "code" | "password" | "success";

export default function PhoneRecoveryPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Forms
  const phoneForm = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
  });

  const codeForm = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
    defaultValues: { phone },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Send verification code
  const onSendCode = async (data: PhoneFormData) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchWithCsrf("/api/auth/password-reset/send-phone-code", {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "发送失败");
      }

      setPhone(data.phone);
      setStep("code");
      setCountdown(60);
      codeForm.setValue("phone", data.phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // Verify code
  const onVerifyCode = async (data: CodeFormData) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchWithCsrf("/api/auth/password-reset/verify-phone-code", {
        method: "POST",
        body: JSON.stringify({ phone: data.phone, code: data.code }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "验证失败");
      }

      setResetToken(result.resetToken);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // Resend code
  const onResendCode = async () => {
    if (countdown > 0) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetchWithCsrf("/api/auth/password-reset/send-phone-code", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "发送失败");
      }

      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const onResetPassword = async (data: PasswordFormData) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchWithCsrf("/api/auth/password-reset/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: resetToken,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "重置失败");
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // Calculate password strength
  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white opacity-20"
            style={{
              width: ((i * 13 % 30) / 10 + 1) + "px",
              height: ((i * 13 % 30) / 10 + 1) + "px",
              top: (i * 197 % 100) + "%",
              left: (i * 373 % 100) + "%",
              animation: `twinkle ${(i * 7 % 30) / 10 + 2}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-600/20 border border-purple-500/30 mb-4">
            <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">手机找回密码</h1>
          <p className="text-slate-400 text-sm">
            {step === "phone" && "输入注册手机号"}
            {step === "code" && "输入验证码"}
            {step === "password" && "设置新密码"}
            {step === "success" && "密码重置成功"}
          </p>
        </div>

        {/* Progress indicator */}
        {step !== "success" && (
          <div className="flex justify-center gap-2 mb-6">
            <div className={`h-1 rounded-full transition-all duration-300 ${
              step === "phone" ? "w-full bg-purple-500" : "w-1/3 bg-purple-500"
            }`} />
            <div className={`h-1 rounded-full transition-all duration-300 ${
              step === "code" || step === "password" ? "w-full bg-purple-500" : "w-1/3 bg-slate-600"
            }`} />
            <div className={`h-1 rounded-full transition-all duration-300 ${
              step === "password" ? "w-full bg-purple-500" : "w-1/3 bg-slate-600"
            }`} />
          </div>
        )}

        {/* Form card */}
        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {step === "phone" && (
            <form onSubmit={phoneForm.handleSubmit(onSendCode)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  手机号码
                </label>
                <input
                  {...phoneForm.register("phone")}
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="请输入注册手机号"
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition"
                />
                {phoneForm.formState.errors.phone && (
                  <p className="mt-1 text-sm text-red-400">{phoneForm.formState.errors.phone.message}</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white font-semibold rounded-xl transition duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    发送中...
                  </>
                ) : (
                  "发送验证码"
                )}
              </button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={codeForm.handleSubmit(onVerifyCode)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  验证码
                </label>
                <input
                  {...codeForm.register("code")}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="请输入6位验证码"
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition text-center text-2xl tracking-widest"
                />
                {codeForm.formState.errors.code && (
                  <p className="mt-1 text-sm text-red-400">{codeForm.formState.errors.code.message}</p>
                )}
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={onResendCode}
                  disabled={countdown > 0}
                  className="text-purple-400 hover:text-purple-300 disabled:text-slate-500 disabled:cursor-not-allowed transition text-sm"
                >
                  {countdown > 0 ? `${countdown}秒后可重发` : "重新发送验证码"}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition duration-200"
                >
                  返回
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white font-semibold rounded-xl transition duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? "验证中..." : "下一步"}
                </button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={passwordForm.handleSubmit(onResetPassword)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  新密码
                </label>
                <input
                  {...passwordForm.register("newPassword", {
                    onChange: (e) => setPasswordStrength(checkPasswordStrength(e.target.value))
                  })}
                  type="password"
                  placeholder="请输入新密码（至少6位）"
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition"
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="mt-1 text-sm text-red-400">{passwordForm.formState.errors.newPassword.message}</p>
                )}

                {/* Password strength indicator */}
                {passwordForm.watch("newPassword") && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            passwordStrength >= level
                              ? level <= 2
                                ? "bg-red-500"
                                : level <= 3
                                ? "bg-yellow-500"
                                : "bg-green-500"
                              : "bg-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {passwordStrength <= 2 && "弱密码"}
                      {passwordStrength === 3 && "中等强度"}
                      {passwordStrength >= 4 && "强密码"}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  确认密码
                </label>
                <input
                  {...passwordForm.register("confirmPassword")}
                  type="password"
                  placeholder="请再次输入新密码"
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition"
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-400">{passwordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("code")}
                  className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition duration-200"
                >
                  返回
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white font-semibold rounded-xl transition duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? "重置中..." : "重置密码"}
                </button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white mb-2">密码重置成功</h2>
                <p className="text-slate-400 text-sm">您的密码已成功修改，现在可以使用新密码登录</p>
              </div>

              <button
                onClick={() => router.push("/login")}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition duration-200"
              >
                前往登录
              </button>
            </div>
          )}

          {/* Back link */}
          {step !== "success" && (
            <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
              <p className="text-slate-400 text-sm">
                <Link href="/forgot-password" className="text-purple-400 hover:text-purple-300 transition">
                  返回上一步
                </Link>
                {" "}/{" "}
                <Link href="/login" className="text-purple-400 hover:text-purple-300 transition">
                  返回登录
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
