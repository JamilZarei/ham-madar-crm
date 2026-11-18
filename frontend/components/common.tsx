import { ArrowUpLeft, Layers3, type LucideIcon, Inbox } from "lucide-react";
import Link from "next/link";
import { cn } from "@shared/utils";
import { Card, CardHeader } from "./ui/card";

export function Brand({ small = false }: { small?: boolean }) {
  return <span className="brand"><span className="brand-mark"><Layers3 size={22} strokeWidth={2.3} /></span>{!small && <span><b>هم‌مدار</b><small>مدیریت ارتباط با مشتری</small></span>}</span>;
}
export function IconTile({ icon: Icon, tone = "indigo", className }: { icon: LucideIcon; tone?: string; className?: string }) {
  return <span className={cn("icon-tile tone-" + tone, className)}><Icon size={18} strokeWidth={1.8} /></span>;
}
export function PageHeading({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="page-eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}
export function PanelHeading({ title, description, icon, action }: { title: string; description?: string; icon?: LucideIcon; action?: React.ReactNode }) {
  return <CardHeader className="panel-heading"><div className="panel-title-group">{icon && <IconTile icon={icon} />}<div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{action}</CardHeader>;
}
export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-link">{children}<ArrowUpLeft size={14} /></Link>;
}
export function Empty({ title = "موردی پیدا نشد", description, icon: Icon = Inbox }: { title?: string; description?: string; icon?: LucideIcon }) {
  return <div className="empty"><IconTile icon={Icon} /><strong>{title}</strong>{description && <p>{description}</p>}</div>;
}
export function Stat({ label, value, icon, tone, foot }: { label: string; value: React.ReactNode; icon: LucideIcon; tone?: string; foot?: React.ReactNode }) {
  return <Card className="stat"><div className="stat-top"><span>{label}</span><IconTile icon={icon} tone={tone} /></div><div className="stat-number">{value}</div>{foot && <div className="stat-foot">{foot}</div>}</Card>;
}

