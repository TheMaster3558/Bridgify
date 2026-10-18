// Pure date bucketing for the Home charts; safe to import anywhere.

const DAY_MS = 86_400_000;

export type SeriesMode = "weekly" | "monthly" | "yearly";
export type Series = {
  labels: string[];
  values: number[];
  // Index of the bucket that contains today; later buckets are in the future.
  current: number;
  previous: number;
  total: number;
};
export type HeatmapDay = { label: string; count: number } | null;
export type Heatmap = {
  weeks: HeatmapDay[][];
  months: { column: number; label: string }[];
  total: number;
  busiest: number;
  longestStreak: number;
  activeDays: number;
};

// Days are counted in the owner's timezone: a day index is the number of days
// since 1970-01-01 for the calendar date the instant falls on there.
function dayIndex(value: string | Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(new Date(value));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Math.floor(
    Date.UTC(get("year"), get("month") - 1, get("day")) / DAY_MS,
  );
}

function utc(day: number) {
  return new Date(day * DAY_MS);
}

// 1970-01-01 was a Thursday; weeks start on Sunday like the template.
function weekStart(day: number) {
  return day - ((day + 4) % 7);
}

function format(day: number, options: Intl.DateTimeFormatOptions) {
  return utc(day).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

function series(
  days: number[],
  keys: number[],
  keyOf: (day: number) => number,
  label: (key: number) => string,
  today: number,
): Series {
  const counts = new Map<number, number>();
  for (const day of days)
    counts.set(keyOf(day), (counts.get(keyOf(day)) ?? 0) + 1);
  const current = keys.indexOf(keyOf(today));
  const values = keys.map((key) => counts.get(key) ?? 0);
  const previousKey = keys[current - 1];
  return {
    labels: keys.map(label),
    values,
    current,
    previous: previousKey === undefined ? 0 : (counts.get(previousKey) ?? 0),
    total: values.reduce((a, b) => a + b, 0),
  };
}

export function bucketSeries(
  dates: string[],
  now: Date,
  timeZone?: string,
): Record<SeriesMode, Series> {
  const today = dayIndex(now, timeZone);
  const days = dates.map((d) => dayIndex(d, timeZone));
  const thisWeek = weekStart(today);
  const year = utc(today).getUTCFullYear();
  const monthKey = (day: number) =>
    utc(day).getUTCFullYear() * 12 + utc(day).getUTCMonth();
  const monthly = series(
    days,
    Array.from({ length: 12 }, (_, m) => year * 12 + m),
    monthKey,
    (key) =>
      format(Math.floor(Date.UTC(year, key % 12, 1) / DAY_MS), {
        month: "short",
      }),
    today,
  );
  // January compares against last December, which is outside the chart.
  if (monthly.current === 0)
    monthly.previous = days.filter((d) => monthKey(d) === year * 12 - 1).length;
  return {
    weekly: series(
      days,
      Array.from({ length: 12 }, (_, i) => thisWeek - (11 - i) * 7),
      weekStart,
      (key) => format(key, { month: "short", day: "numeric" }),
      today,
    ),
    monthly,
    yearly: series(
      days,
      Array.from({ length: 5 }, (_, i) => year - 4 + i),
      (day) => utc(day).getUTCFullYear(),
      String,
      today,
    ),
  };
}

export function buildHeatmap(
  dates: string[],
  now: Date,
  timeZone?: string,
): Heatmap {
  const today = dayIndex(now, timeZone);
  const start = weekStart(today) - 52 * 7;
  const counts = new Map<number, number>();
  for (const date of dates) {
    const day = dayIndex(date, timeZone);
    if (day >= start && day <= today)
      counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const weeks: HeatmapDay[][] = [];
  const months: Heatmap["months"] = [];
  let streak = 0;
  let longestStreak = 0;
  let activeDays = 0;
  for (let column = 0; column < 53; column++) {
    const week: HeatmapDay[] = [];
    for (let row = 0; row < 7; row++) {
      const day = start + column * 7 + row;
      if (day > today) {
        week.push(null);
        continue;
      }
      const count = counts.get(day) ?? 0;
      streak = count ? streak + 1 : 0;
      longestStreak = Math.max(longestStreak, streak);
      if (count) activeDays++;
      week.push({
        label: format(day, { month: "short", day: "numeric", year: "numeric" }),
        count,
      });
      if (utc(day).getUTCDate() === 1)
        months.push({ column, label: format(day, { month: "short" }) });
    }
    weeks.push(week);
  }
  const values = [...counts.values()];
  return {
    weeks,
    months,
    total: values.reduce((a, b) => a + b, 0),
    busiest: Math.max(0, ...values),
    longestStreak,
    activeDays,
  };
}
