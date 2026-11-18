"use client";

import { AlertDialog, Avatar, Checkbox as RadixCheckbox, Dialog, DropdownMenu, Popover, Switch as RadixSwitch, Tabs, Tooltip } from "radix-ui";
import { Check, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@shared/utils";

export { Tabs };
export function Input({ className, ...props }: React.ComponentProps<"input">) { return <input data-slot="input" className={cn("field-input", className)} {...props} />; }
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) { return <textarea data-slot="textarea" className={cn("field-input field-textarea", className)} {...props} />; }
export function Select({ className, children, ...props }: React.ComponentProps<"select">) { return <select className={cn("field-input field-select", className)} {...props}>{children}</select>; }
export function Badge({ tone = "neutral", children }: { tone?: string; children: React.ReactNode }) { return <span data-slot="badge" className={"badge tone-" + tone}><i />{children}</span>; }
export function PersonAvatar({ name, tone = "indigo", className }: { name: string; tone?: string; className?: string }) {
  return <Avatar.Root aria-hidden="true" title={name} className={cn("avatar tone-" + tone, className)}><Avatar.Fallback>{name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "ک"}</Avatar.Fallback></Avatar.Root>;
}
export function CheckBox({ label, ...props }: React.ComponentProps<typeof RadixCheckbox.Root> & { label: string }) {
  return <RadixCheckbox.Root className="checkbox" aria-label={label} {...props}><RadixCheckbox.Indicator><Check size={12} strokeWidth={3} /></RadixCheckbox.Indicator></RadixCheckbox.Root>;
}
export function Switch({ label, ...props }: React.ComponentProps<typeof RadixSwitch.Root> & { label: string }) {
  return <RadixSwitch.Root aria-label={label} className="switch" {...props}><RadixSwitch.Thumb className="switch-thumb" /></RadixSwitch.Root>;
}
export function Hint({ label, children }: { label: string; children: React.ReactElement }) {
  return <Tooltip.Root><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content side="left" sideOffset={7} className="tooltip" dir="rtl">{label}<Tooltip.Arrow /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
}
export function Menu({ trigger, children }: { trigger: React.ReactElement; children: React.ReactNode }) {
  return <DropdownMenu.Root dir="rtl"><DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="popup menu" align="end" sideOffset={6}>{children}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}
export const MenuItem = DropdownMenu.Item;
export const MenuSeparator = DropdownMenu.Separator;
export function Pop({ trigger, children, open, onOpenChange }: { trigger: React.ReactElement; children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return <Popover.Root open={open} onOpenChange={onOpenChange}><Popover.Trigger asChild>{trigger}</Popover.Trigger><Popover.Portal><Popover.Content className="popup" dir="rtl" align="end" sideOffset={8}>{children}</Popover.Content></Popover.Portal></Popover.Root>;
}
export function Modal({ open, onOpenChange, title, description, children, sheet = false, className, trigger }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode; sheet?: boolean; className?: string; trigger?: React.ReactElement;
}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>{trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}<Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay" /><Dialog.Content className={cn("dialog-content", sheet && "sheet-content", className)} dir="rtl">
      <div className="dialog-head"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description className={description ? "muted" : "sr-only"}>{description || title}</Dialog.Description></div>
        <Dialog.Close asChild><Button size="icon" variant="ghost" aria-label="بستن"><X size={18} /></Button></Dialog.Close></div>
      {children}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
export function Confirm({ open, close, title, description, onConfirm }: { open: boolean; close: () => void; title: string; description: string; onConfirm: () => void }) {
  return <AlertDialog.Root open={open} onOpenChange={(value) => { if (!value) close(); }}><AlertDialog.Portal><AlertDialog.Overlay className="dialog-overlay" />
    <AlertDialog.Content dir="rtl" className="dialog-content"><AlertDialog.Title>{title}</AlertDialog.Title><AlertDialog.Description className="muted">{description}</AlertDialog.Description>
      <div className="dialog-actions"><AlertDialog.Cancel asChild><Button variant="outline">انصراف</Button></AlertDialog.Cancel><AlertDialog.Action asChild><Button variant="danger" onClick={onConfirm}>حذف شود</Button></AlertDialog.Action></div>
    </AlertDialog.Content>
  </AlertDialog.Portal></AlertDialog.Root>;
}



