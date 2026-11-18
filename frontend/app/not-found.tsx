import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <main className="center-page"><h1>صفحه پیدا نشد</h1><Button asChild><Link href="/dashboard/">بازگشت به داشبورد</Link></Button></main>; }
