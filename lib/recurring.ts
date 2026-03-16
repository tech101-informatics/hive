export function calculateNextRunDate(
  frequency: "daily" | "weekly" | "monthly",
  fromDate: Date,
  dayOfWeek?: number,
  dayOfMonth?: number,
): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly": {
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) {
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, maxDay));
      }
      break;
    }
  }
  return next;
}
