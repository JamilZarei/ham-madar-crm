import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns-jalali";

export function cn(...values: ClassValue[]) { return twMerge(clsx(values)); }
export const number = new Intl.NumberFormat("fa-IR");
export const compact = new Intl.NumberFormat("fa-IR", { notation: "compact", maximumFractionDigits: 1 });
export const fa = (value: number) => number.format(value);
export const money = (value: number | string) => number.format(typeof value === "string" ? BigInt(value) : value) + " تومان";
export const digits = (value: string) => value.replace(/[۰-۹]/g, (v) => String(v.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (v) => String(v.charCodeAt(0) - 1632));
export const faDigits = (value: string) => value.replace(/[0-9]/g, (v) => String.fromCharCode(1776 + Number(v)));
export const humanDate = (value: string | Date, pattern = "d MMMM yyyy") => value ? faDigits(format(typeof value === "string" ? asDate(value) : value, pattern)) : "—";
export const time = (value: string | Date) => humanDate(value, "HH:mm");
export const today = (offset = 0) => { const day = new Date(); day.setDate(day.getDate() + offset); return day; };
export const isoDay = (value = new Date()) => formatGregorianDate(value);
function formatGregorianDate(value: Date) { return [value.getFullYear(), value.getMonth() + 1, value.getDate()].map((part) => String(part).padStart(2, "0")).join("-"); }
export function searchText(value: string) { return digits(value.trim().toLowerCase().replaceAll("ي", "ی").replaceAll("ك", "ک").replace(/[\u200c\u200f]/g, "")); }
export const asDate = (value: string) => value.length === 10 ? new Date(value + "T12:00:00") : new Date(value);
export const shortDate = (value: string) => value ? humanDate(asDate(value), "d MMMM") : "—";
export const id = () => crypto.randomUUID();
export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
