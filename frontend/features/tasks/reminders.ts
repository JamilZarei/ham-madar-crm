import { type Task } from "@shared/model";

const reminderMinutes: Record<string, number> = { "۳۰ دقیقه قبل": 30, "۱ ساعت قبل": 60, "۱ روز قبل": 1440 };
export function taskAlerts(items: Task[], time = Date.now()) {
  return items.filter((task) => {
    const due = new Date(task.due + "T" + (task.dueTime || "17:00") + ":00").getTime();
    return task.status !== "انجام‌شده" && due - (reminderMinutes[task.reminder] || 0) * 60_000 <= time;
  });
}
