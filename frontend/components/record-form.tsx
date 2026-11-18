"use client";

import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/primitives";
import { JalaliDatePicker } from "./calendar-picker";
import { digits, faDigits } from "@shared/utils";
import { ClientError } from "@/lib/client/http";
import { useResource } from "@/lib/repository";
import { iranMobile } from "@/features/auth/service";

export type Field = {
  key: string; label: string; required?: boolean; kind?: "text" | "mobile" | "email" | "url" | "number" | "date" | "time" | "textarea" | "select";
  options?: readonly (string | { label: string; value: string })[]; min?: number; max?: number; placeholder?: string; ltr?: boolean; wide?: boolean; disabled?: boolean;
};
export type Fields = Record<string, string>;
export const choices = (items: { id: string; name: string }[]) => items.map(({ id, name }) => ({ value: id, label: name }));
export const ownerChoices = (users: { id: string; name: string; active: boolean }[]) => users.filter((user) => user.active).map((user) => ({ value: user.id, label: user.name }));

type Choice = { value: string; label: string };
type LookupRows = { rows: { id: string; name: string }[] };
function RecordSelect({ collection, label, value, onChange, options, input }: {
  collection: "contacts" | "companies"; label: string; value: string; onChange: (value: string) => void;
  options: Field["options"]; input: React.ComponentProps<typeof Select>;
}) {
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Choice>();
  const path = `/api/crm/records/${collection}/`;
  const initial = (options ?? []).map((option) => typeof option === "string" ? { value: option, label: option } : option);
  const lookup = useResource<LookupRows>(search.trim() ? `${path}?size=20&sort=name&direction=asc&search=${encodeURIComponent(search.trim())}` : null, 230);
  const existing = initial.find((option) => option.value === value) ?? (chosen?.value === value ? chosen : undefined);
  const detail = useResource<LookupRows>(value && !existing ? `${path}?id=${encodeURIComponent(value)}` : null);
  const visible = search.trim() ? choices(lookup.data?.rows ?? []) : initial;
  const current = existing ?? choices(detail.data?.rows ?? [])[0];
  const records = value && !visible.some((option) => option.value === value)
    ? [{ value, label: current?.label ?? "رکورد مرتبط" }, ...visible]
    : visible;

  return <>
    <Input aria-label={`جست‌وجوی ${label}`} placeholder={`جست‌وجوی ${label}…`} value={search} maxLength={150} onChange={(event) => setSearch(event.target.value)} />
    <Select {...input} value={value} onChange={(event) => {
      const selected = event.target.value;
      setChosen(records.find((option) => option.value === selected));
      onChange(selected);
    }}>
      <option value="">{lookup.loading ? "در حال جست‌وجو…" : "انتخاب کنید"}</option>
      {records.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Select>
    {lookup.error && <span role="alert" className="field-error">{lookup.error}</span>}
  </>;
}

function formSchema(fields: Field[]) {
  return z.record(z.string(), z.string()).superRefine((data, context) => {
    fields.forEach((field) => {
      const value = (data[field.key] || "").trim();
      const add = (message: string) => context.addIssue({ code: "custom", path: [field.key], message });
      if (!value) { if (field.required) add("وارد کردن " + field.label + " الزامی است."); return; }
      if (field.kind === "mobile" && !iranMobile.test(digits(value))) add("شماره موبایل ایران معتبر نیست.");
      if (field.kind === "email" && !z.email().safeParse(value).success) add("نشانی ایمیل معتبر نیست.");
      if (field.kind === "url" && !/^https?:\/\//i.test(value)) add("نشانی باید با http یا https شروع شود.");
      else if (field.kind === "url" && !z.url().safeParse(value).success) add("نشانی اینترنتی معتبر نیست.");
      if (field.kind === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(digits(value))) add("زمان را در قالب ساعت و دقیقه وارد کنید.");
      if (field.kind === "number") {
        const number = Number(digits(value));
        if (field.key === "value" ? !/^\d{1,20}$/.test(digits(value)) : !Number.isInteger(number) || number < (field.min ?? 0) || number > (field.max ?? Number.MAX_SAFE_INTEGER)) add("مقدار عددی در بازهٔ مجاز نیست.");
      }
    });
  });
}

export function RecordForm({ fields, initial = {}, onSave, onCancel, submitText = "ذخیره", extra }: {
  fields: Field[]; initial?: Record<string, unknown>; onSave: (data: Fields) => void | Promise<unknown>; onCancel: () => void; submitText?: string; extra?: React.ReactNode;
}) {
  const prefix = useId();
  const { control, register, setError, handleSubmit, formState: { errors, isSubmitting } } = useForm<Fields>({
    resolver: zodResolver(formSchema(fields)), defaultValues: Object.fromEntries(fields.map((field) => [field.key, field.kind === "number" || field.kind === "time" ? faDigits(String(initial[field.key] ?? "")) : String(initial[field.key] ?? "")])),
  });
  async function submit(values: Fields) {
    try {
      await onSave(Object.fromEntries(Object.entries(values).map(([key, value]) => {
        const kind = fields.find((field) => field.key === key)?.kind;
        return [key, kind === "number" || kind === "mobile" || kind === "time" ? digits(value.trim()) : value.trim()];
      })));
    } catch (error) {
      if (error instanceof ClientError) for (const [path, message] of Object.entries(error.fields ?? {})) {
        const key = path.split(".").at(-1);
        const field = key === "amountToman" ? "value" : key;
        if (field && fields.some((entry) => entry.key === field)) setError(field, { type: "server", message });
      }
      toast.error(error instanceof Error ? error.message : "ذخیرهٔ اطلاعات انجام نشد.");
    }
  }
  return <form onSubmit={handleSubmit(submit)} noValidate>
    <div className="form-grid">{fields.map((field) => {
      const fieldId = prefix + field.key;
      const error = errors[field.key]?.message;
      const props = { id: fieldId, "aria-invalid": !!error, "aria-describedby": error ? fieldId + "-error" : undefined, "aria-required": field.required, disabled: field.disabled };
      const direction = field.ltr || field.kind === "mobile" || field.kind === "email" || field.kind === "url" || field.kind === "time" ? "ltr" : "rtl";
      const collection = field.key === "companyId" ? "companies" : field.key === "contactId" ? "contacts" : undefined;
      return <div key={field.key} className={"field-label" + (field.wide || field.kind === "textarea" ? " field-wide" : "")}>
        <label htmlFor={field.kind === "date" ? undefined : fieldId}>{field.label}{field.required && <span className="danger-text"> *</span>}</label>
        {field.kind === "date" ? <Controller control={control} name={field.key} render={({ field: value }) => <JalaliDatePicker label={field.label} value={value.value} onChange={value.onChange} invalid={!!error} />} /> :
          field.kind === "select" && collection ? <Controller control={control} name={field.key} render={({ field: value }) => <RecordSelect collection={collection} label={field.label} value={value.value} onChange={value.onChange} options={field.options} input={{ ...props, name: value.name, ref: value.ref, onBlur: value.onBlur }} />} /> :
          field.kind === "select" ? <Select {...props} {...register(field.key)}><option value="">انتخاب کنید</option>{field.options?.map((option) => typeof option === "string" ? <option key={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}</Select> :
          field.kind === "textarea" ? <Textarea {...props} placeholder={field.placeholder} {...register(field.key)} /> :
          <Input {...props} dir={direction} inputMode={field.kind === "mobile" ? "tel" : field.kind === "number" || field.kind === "time" ? "decimal" : field.kind === "email" ? "email" : undefined}
            placeholder={field.placeholder || (field.kind === "time" ? "09:30" : undefined)} {...register(field.key)} />}
        {error && <span id={fieldId + "-error"} className="field-error" role="alert">{error}</span>}
      </div>;
    })}</div>
    {extra}
    <div className="dialog-actions"><Button type="button" variant="outline" onClick={onCancel}>انصراف</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "در حال ذخیره…" : submitText}</Button></div>
  </form>;
}
