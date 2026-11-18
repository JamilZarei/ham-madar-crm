"use client";

import { type FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { PanelHeading } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/primitives";
import { refreshCRM } from "@/lib/repository";
import { auth } from "./service";

export function PasswordSettings({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const length = Array.from(password).length;
    if (length < 15 || length > 128) { setError("رمز عبور باید ۱۵ تا ۱۲۸ نویسه داشته باشد."); return; }
    if (password !== data.get("confirmation")) { setError("تکرار رمز با رمز جدید یکسان نیست."); return; }

    setBusy(true);
    setError("");
    try {
      await auth.changePassword(password, configured ? String(data.get("currentPassword") ?? "") : undefined);
      form.reset();
      refreshCRM();
      toast.success("رمز عبور ذخیره شد.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "ذخیرهٔ رمز انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return <Card>
    <PanelHeading title={configured ? "تغییر رمز عبور" : "تعیین رمز عبور"} icon={KeyRound}
      description={configured ? "بعد از تغییر رمز، نشست‌های دیگر این حساب بسته می‌شوند." : "رمز اول را تا ۱۰ دقیقه بعد از ورود با کد یک‌بارمصرف تعیین کنید."} />
    <CardContent>
      <form className="stack" onSubmit={save}>
        {configured && <label className="field-label">رمز عبور فعلی
          <Input name="currentPassword" type="password" dir="auto" autoComplete="current-password" maxLength={256} required />
        </label>}
        <label className="field-label">رمز عبور جدید
          <Input name="password" type="password" dir="auto" autoComplete="new-password" maxLength={256} required />
        </label>
        <label className="field-label">تکرار رمز عبور جدید
          <Input name="confirmation" type="password" dir="auto" autoComplete="new-password" maxLength={256} required />
        </label>
        {error && <p role="alert" className="field-error">{error}</p>}
        <div><Button type="submit" disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیرهٔ رمز عبور"}</Button></div>
      </form>
    </CardContent>
  </Card>;
}
