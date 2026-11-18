import { z } from "zod";
import { digits } from "@shared/utils";
import { invalid } from "@backend/lib/errors/domain";

export const uuid = z.uuid("شناسه معتبر نیست.");
export const text = (max = 200) => z.string("مقدار باید متن باشد.").trim().max(max, "متن بیش از حد طولانی است.");
export const required = (max = 200) => text(max).min(1, "وارد کردن مقدار الزامی است.");
export const optional = (max = 200) => text(max).nullish().transform((value) => value || null);
export const optionalId = z.union([uuid, z.literal("")]).nullish().transform((value) => value || null);
export const email = z.union([z.email("ایمیل معتبر نیست."), z.literal("")]).nullish().transform((value) => value || null);
export const numberIn = (min: number, max: number) => z.number("مقدار عددی لازم است.").int("عدد صحیح وارد کنید.").min(min, "عدد خارج از بازه است.").max(max, "عدد خارج از بازه است.");
export const phone = z.string("شماره موبایل الزامی است.").trim().transform(digits).refine((value) => /^(?:09\d{9}|\+989\d{9})$/.test(value), "شماره موبایل ایران معتبر نیست.").transform((value) => value.startsWith("+") ? value : "+98" + value.slice(1));
export const localPhone = (value: string) => value.startsWith("+98") ? "0" + value.slice(3) : value;
export function dateOnly(value: string): Date {
  const date = new Date(value + "T00:00:00.000Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw invalid("تاریخ معتبر نیست.");
  return date;
}
export const dateField = z.iso.date("تاریخ معتبر نیست.").transform(dateOnly);
export const optionalDate = z.union([dateField, z.literal("")]).nullish().transform((value) => value || null);
export const timeField = z.string().transform(digits).refine((value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value), "ساعت معتبر نیست.").transform((value) => new Date("1970-01-01T" + value + ":00.000Z"));
export const optionalTime = z.union([timeField, z.literal("")]).nullish().transform((value) => value || null);
export const isoDate = (date?: Date | null) => date?.toISOString().slice(0, 10) || "";
export const isoTime = (date?: Date | null) => date?.toISOString().slice(11, 16) || "";
