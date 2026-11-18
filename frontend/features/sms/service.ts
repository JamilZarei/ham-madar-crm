import { type Contact } from "@shared/model";

export const variables = ["{{customer_name}}", "{{company_name}}"];
const segment = (text: string) => /[^\x20-\x7e\n\r]/.test(text) ? [70, 67] : [160, 153];
export function segmentCount(text: string) {
  const [single, multipart] = segment(text);
  return text.length === 0 ? 0 : text.length <= single ? 1 : Math.ceil(text.length / multipart);
}
export function renderMessage(text: string, contact?: Pick<Contact, "name">, company?: string) {
  return text.replaceAll(variables[0], contact?.name || "مشتری گرامی").replaceAll(variables[1], company || "شرکت شما");
}

