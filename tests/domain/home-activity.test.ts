import { describe, expect, it } from "vitest";
import { bucketSeries, buildHeatmap } from "@/lib/dashboard/activity-series";

// Sunday, October 18 2026, mid-morning in Los Angeles.
const now = new Date("2026-10-18T16:41:00Z");
const zone = "America/Los_Angeles";

describe("home activity series", () => {
  it("buckets by month for the current year and compares with last month", () => {
    const series = bucketSeries(
      [
        "2026-10-01T18:00:00Z",
        "2026-10-17T18:00:00Z",
        "2026-09-03T18:00:00Z",
        "2025-10-10T18:00:00Z",
      ],
      now,
      zone,
    ).monthly;
    expect(series.labels[0]).toBe("Jan");
    expect(series.labels).toHaveLength(12);
    expect(series.current).toBe(9);
    expect(series.values[9]).toBe(2);
    expect(series.previous).toBe(1);
    expect(series.total).toBe(3);
  });

  it("counts days in the owner's timezone", () => {
    // 03:00 UTC on Oct 1 is still September 30 in Los Angeles.
    const series = bucketSeries(["2026-10-01T03:00:00Z"], now, zone).monthly;
    expect(series.values[8]).toBe(1);
    expect(series.values[9]).toBe(0);
  });

  it("uses Sunday-start weeks ending this week, and five years", () => {
    const { weekly, yearly } = bucketSeries(
      ["2026-10-18T17:00:00Z", "2026-10-17T17:00:00Z", "2022-05-01T17:00:00Z"],
      now,
      zone,
    );
    expect(weekly.labels.at(-1)).toBe("Oct 18");
    expect(weekly.current).toBe(11);
    expect(weekly.values.slice(-2)).toEqual([1, 1]);
    expect(yearly.labels).toEqual(["2022", "2023", "2024", "2025", "2026"]);
    expect(yearly.values[0]).toBe(1);
  });

  it("compares January with the previous December", () => {
    const january = new Date("2027-01-10T18:00:00Z");
    const series = bucketSeries(
      ["2026-12-05T18:00:00Z", "2026-12-06T18:00:00Z", "2027-01-02T18:00:00Z"],
      january,
      zone,
    ).monthly;
    expect(series.current).toBe(0);
    expect(series.previous).toBe(2);
  });
});

describe("home activity heatmap", () => {
  it("lays out 53 Sunday-first weeks with streaks and the busiest day", () => {
    const map = buildHeatmap(
      [
        "2026-10-16T18:00:00Z",
        "2026-10-17T18:00:00Z",
        "2026-10-17T19:00:00Z",
        "2026-10-18T17:00:00Z",
        "2026-10-10T18:00:00Z",
      ],
      now,
      zone,
    );
    expect(map.weeks).toHaveLength(53);
    expect(map.weeks.every((w) => w.length === 7)).toBe(true);
    // Today is the first day of the last week; the rest is in the future.
    expect(map.weeks[52][0]).toMatchObject({ count: 1 });
    expect(map.weeks[52].slice(1)).toEqual(Array(6).fill(null));
    expect(map.total).toBe(5);
    expect(map.busiest).toBe(2);
    expect(map.longestStreak).toBe(3);
    expect(map.activeDays).toBe(4);
    expect(map.months.at(-1)).toMatchObject({ label: "Oct" });
  });
});
