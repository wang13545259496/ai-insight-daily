import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  addDays,
  buildDateRange,
  diffInDays,
  formatDateOnly,
  isDateString,
  isPeakSeason,
  parseDateOnly,
  resolveDuration,
  weekdayLabel,
} from "./date";

describe("travel/date 日期解析", () => {
  it("识别合法的 YYYY-MM-DD", () => {
    assert.equal(isDateString("2026-10-01"), true);
    assert.equal(isDateString("2026-1-1"), false);
    assert.equal(isDateString("20261001"), false);
    assert.equal(isDateString(20261001), false);
  });

  it("拒绝格式正确但不存在的日期", () => {
    // 2026 不是闰年，2 月 29 日不存在
    assert.equal(parseDateOnly("2026-02-29"), null);
    assert.equal(parseDateOnly("2026-13-01"), null);
    assert.equal(parseDateOnly("2026-04-31"), null);
  });

  it("解析为 UTC 零点，不受本地时区影响", () => {
    const timestamp = parseDateOnly("2026-10-01");

    assert.equal(timestamp, Date.UTC(2026, 9, 1));
    assert.equal(formatDateOnly(timestamp!), "2026-10-01");
  });
});

describe("travel/date 天数推算", () => {
  it("去返程同一天为 0 晚 1 天", () => {
    assert.deepEqual(resolveDuration("2026-10-01", "2026-10-01"), { nights: 0, days: 1 });
  });

  it("5 天 4 晚", () => {
    assert.deepEqual(resolveDuration("2026-10-01", "2026-10-05"), { nights: 4, days: 5 });
  });

  it("跨月与跨年正确", () => {
    assert.equal(diffInDays("2026-01-31", "2026-02-01"), 1);
    assert.equal(diffInDays("2026-12-31", "2027-01-01"), 1);
    assert.equal(diffInDays("2026-02-27", "2026-03-02"), 3);
  });

  it("闰年 2 月 29 日存在且可参与计算", () => {
    assert.equal(parseDateOnly("2028-02-29") !== null, true);
    assert.equal(diffInDays("2028-02-28", "2028-03-01"), 2);
  });

  it("返程早于去程返回 null", () => {
    assert.equal(resolveDuration("2026-10-05", "2026-10-01"), null);
  });

  it("加减天数与日期序列一致", () => {
    assert.equal(addDays("2026-10-01", 4), "2026-10-05");
    assert.equal(addDays("2026-10-01", -1), "2026-09-30");
    assert.deepEqual(buildDateRange("2026-10-30", 3), [
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("非法日期加天数返回 null", () => {
    assert.equal(addDays("not-a-date", 1), null);
  });

  it("星期计算正确", () => {
    // 2026-10-01 是星期四
    assert.equal(weekdayLabel("2026-10-01"), "周四");
  });
});

describe("travel/date 旺季识别", () => {
  it("暑假与黄金周算旺季", () => {
    assert.equal(isPeakSeason("2026-07-15"), true);
    assert.equal(isPeakSeason("2026-08-20"), true);
    assert.equal(isPeakSeason("2026-10-03"), true);
  });

  it("非旺季日期不算旺季", () => {
    assert.equal(isPeakSeason("2026-03-15"), false);
    assert.equal(isPeakSeason("2026-10-20"), false);
    assert.equal(isPeakSeason("2026-11-11"), false);
  });
});
