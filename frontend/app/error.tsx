"use client";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/common";

export default function ErrorScreen({ reset }: { reset: () => void }) {
  return <main className="center-page" role="alert"><IconTile icon={CircleAlert} tone="red" /><h1>بارگیری صفحه انجام نشد</h1><p className="muted">صفحه را دوباره بارگیری کنید یا به داشبورد برگردید.</p><div className="row"><Button onClick={reset}>تلاش دوباره</Button><Button variant="outline" asChild><Link href="/dashboard/">داشبورد</Link></Button></div></main>;
}
