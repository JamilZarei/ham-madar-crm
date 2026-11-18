"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChartNoAxesCombined, CircleCheck, Clock3, KeyRound, MessageSquareText, ShieldCheck, Smartphone, TrendingUp, UsersRound, Workflow } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Brand, IconTile } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { InputOTP, InputOTPSlot } from "@/components/ui/input-otp";
import { digits, fa, faDigits } from "@shared/utils";
import { auth, iranMobile, waitSeconds } from "./service";

const loginSchema = z.object({
  mobile: z.string().trim().transform(digits).refine((value) => iranMobile.test(value), "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود."),
  password: z.string().max(256, "رمز عبور بیش از حد طولانی است.").optional(),
});
type LoginFields = z.input<typeof loginSchema>;

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-layout">
    <section className="auth-primary"><div className="auth-brand"><Brand /></div><div className="auth-form-wrap">{children}</div><footer><ShieldCheck size={15} /> هم‌مدار</footer></section>
    <aside className="auth-aside"><div className="auth-art">
      <div className="auth-art-kicker"><Workflow size={18} /> فضای کار فروش</div>
      <h2>هر رابطه، یک مسیر.</h2><p>مشتریان، فرصت‌های فروش و پیگیری‌های تیم را در یک فضای کاری مدیریت کنید.</p>
      <div className="auth-preview" aria-hidden="true"><div className="auth-preview-head"><span><ChartNoAxesCombined size={17} /> روند فروش</span><span>۳۰ روز گذشته</span></div>
        <div className="auth-preview-chart">{[23, 34, 30, 49, 43, 59, 54, 75, 67, 89, 82, 100].map((height, index) => <i key={index} style={{ height: height + "%" }} />)}</div>
        <div className="auth-preview-bottom"><span><TrendingUp size={15} /> فرصت‌های فعال</span><span><UsersRound size={15} /> مشتریان جدید</span></div>
      </div>
    </div></aside>
  </main>;
}

export function Login({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"otp" | "password">(demo ? "otp" : "password");
  const byPassword = mode === "password";
  const { register, handleSubmit, setValue, setFocus, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<LoginFields>({ resolver: zodResolver(loginSchema), defaultValues: { mobile: "", password: "" } });
  async function submit({ mobile, password }: LoginFields) {
    if (byPassword && !password) {
      setError("password", { message: "رمز عبور را وارد کنید." }, { shouldFocus: true });
      return;
    }
    try {
      if (byPassword && password) {
        await auth.signInWithPassword(mobile, password);
        window.location.replace("/dashboard/");
      } else {
        await auth.request(mobile);
        router.push("/verify/");
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "ورود انجام نشد."); }
  }
  function choose(next: "otp" | "password") {
    if (next === mode) return;
    setMode(next);
    setValue("password", "");
    clearErrors("password");
  }
  return <AuthLayout><IconTile icon={byPassword ? KeyRound : Smartphone} /><h1>ورود به حساب کاربری</h1>
    <p>{byPassword ? "شماره موبایل و رمز عبور حساب خود را وارد کنید." : "شماره موبایل خود را وارد کنید تا کد تأیید را دریافت کنید."}</p>
    <div className="auth-methods" role="group" aria-label="روش ورود">
      <button type="button" aria-pressed={byPassword} disabled={isSubmitting} onClick={() => choose("password")}>رمز عبور</button>
      <button type="button" aria-pressed={!byPassword} disabled={isSubmitting} onClick={() => choose("otp")}>کد یک‌بارمصرف</button>
    </div>
    <form onSubmit={handleSubmit(submit)} className="auth-form" noValidate>
      <label className="field-label">شماره موبایل ایران<Input placeholder="۰۹۱۲۳۴۵۶۷۸۹" dir="ltr" className="technical" inputMode="tel" autoComplete="tel-national" type="tel" aria-invalid={!!errors.mobile} aria-describedby={errors.mobile ? "mobile-error" : undefined} {...register("mobile")} /></label>
      {errors.mobile && <div id="mobile-error" role="alert" className="field-error">{errors.mobile.message}</div>}
      {byPassword && <label className="field-label">رمز عبور<Input dir="auto" type="password" autoComplete="current-password" maxLength={256} aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} {...register("password")} /></label>}
      {byPassword && errors.password && <div id="password-error" role="alert" className="field-error">{errors.password.message}</div>}
      <Button disabled={isSubmitting} type="submit">{isSubmitting ? "در حال بررسی…" : byPassword ? "ورود با رمز عبور" : "دریافت کد تأیید"} <ArrowLeft size={17} /></Button>
    </form>
    {demo && !byPassword && <button className="text-link auth-demo" type="button" onClick={() => { setValue("mobile", "۰۹۱۲۳۴۵۶۷۸۹", { shouldValidate: true }); setFocus("mobile"); }}>استفاده از شمارهٔ نمونه</button>}
    <p className="auth-links">برای دریافت حساب، با مدیر فضای کاری خود تماس بگیرید.</p>
  </AuthLayout>;
}

export function Verify() {
  const router = useRouter();
  const [challenge, setChallenge] = useState<ReturnType<typeof auth.challenge>>(null);
  const [remaining, setRemaining] = useState(waitSeconds);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const record = auth.challenge();
    if (!record) router.replace("/login/");
    else {
      const update = () => setRemaining(Math.max(0, Math.ceil((Date.parse(record.expiresAt) - Date.now()) / 1000)));
      const setup = window.setTimeout(() => { setChallenge(record); update(); }, 0);
      return () => clearTimeout(setup);
    }
  }, [router]);
  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [challenge]);
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) { setError("هر شش رقم کد تأیید را وارد کنید."); return; }
    setBusy("verify"); setError("");
    try { await auth.verify(digits(code)); window.location.replace("/dashboard/"); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "تأیید کد انجام نشد."); }
    finally { setBusy(null); }
  }
  async function resend() {
    if (!challenge || remaining || busy) return;
    setBusy("resend"); setError(""); setCode("");
    try { const next = await auth.request(challenge.mobile, true); setChallenge(next); setRemaining(next.resendAfter); toast.success("درخواست کد جدید ثبت شد."); }
    catch { setError("دریافت کد جدید انجام نشد."); }
    finally { setBusy(null); }
  }
  if (!challenge) return <AuthLayout><Skeleton className="h-12 w-full" role="status" aria-label="در حال بارگیری" /></AuthLayout>;
  return <AuthLayout><IconTile icon={MessageSquareText} /><h1>تأیید شماره موبایل</h1>
    <p>کد شش‌رقمی شمارهٔ <bdi dir="ltr">{faDigits(challenge.mobile)}</bdi> را وارد کنید.</p>
    {challenge.demoCode && <div className="auth-inbox"><MessageSquareText size={17} /><span>صندوق پیامک آزمایشی</span><b dir="ltr">{faDigits(challenge.demoCode)}</b></div>}
    <form className="auth-form" onSubmit={verify}>
      <div dir="ltr"><InputOTP value={code} onChange={setCode} pattern="^[0-9۰-۹٠-٩]*$" maxLength={6} inputMode="numeric" aria-label="کد تأیید شش‌رقمی" aria-invalid={!!error} pasteTransformer={digits} autoFocus>
        {Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} />)}
      </InputOTP></div>
      {error && <div role="alert" className="field-error">{error}</div>}
      <Button type="submit" disabled={!!busy}>{busy === "verify" ? "در حال بررسی…" : "تأیید و ورود"} <CircleCheck size={16} /></Button>
    </form>
    <div className="spread auth-links"><button className="text-link" onClick={() => router.replace("/login/")}><ArrowRight size={14} /> ویرایش شماره</button>
      {remaining > 0 ? <span className="row muted"><Clock3 size={14} /> {fa(remaining)} ثانیه تا ارسال مجدد</span> : <button className="text-link" disabled={!!busy} onClick={resend}>{busy ? "در حال ارسال…" : "ارسال مجدد کد"}</button>}
    </div>
  </AuthLayout>;
}





