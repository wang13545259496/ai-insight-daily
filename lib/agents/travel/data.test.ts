import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeFingerprint } from "./data";
import type { TripQuery } from "./types";

/**
 * 需求指纹测试。
 *
 * 指纹决定「同一需求」的判定，过松会导致不同需求互相覆盖，
 * 过严则去重失效。这里把两类边界都固定下来。
 */

function makeQuery(overrides: Partial<TripQuery> = {}): TripQuery {
  return {
    origin: "北京",
    destination: "三亚",
    departDate: "2026-12-10",
    returnDate: "2026-12-14",
    party: { adults: 2, children: 0 },
    budget: 12000,
    style: "comfort",
    interests: ["美食"],
    ...overrides,
  };
}

describe("travel/data 需求指纹", () => {
  it("同一需求得到相同指纹", () => {
    assert.equal(computeFingerprint(makeQuery()), computeFingerprint(makeQuery()));
  });

  it("偏好顺序不影响指纹", () => {
    const a = makeQuery({ interests: ["美食", "博物馆"] });
    const b = makeQuery({ interests: ["博物馆", "美食"] });

    assert.equal(computeFingerprint(a), computeFingerprint(b));
  });

  it("城市大小写与首尾空格不影响指纹", () => {
    const a = makeQuery({ origin: "Beijing", destination: "Sanya" });
    const b = makeQuery({ origin: "  beijing ", destination: "sanya" });

    assert.equal(computeFingerprint(a), computeFingerprint(b));
  });

  it("出发地或目的地不同则指纹不同", () => {
    assert.notEqual(
      computeFingerprint(makeQuery()),
      computeFingerprint(makeQuery({ destination: "丽江" })),
    );
  });

  it("日期不同则指纹不同", () => {
    assert.notEqual(
      computeFingerprint(makeQuery()),
      computeFingerprint(makeQuery({ departDate: "2026-12-11", returnDate: "2026-12-15" })),
    );
  });

  it("人数、预算、档位不同则指纹不同", () => {
    const base = computeFingerprint(makeQuery());

    assert.notEqual(base, computeFingerprint(makeQuery({ party: { adults: 3, children: 0 } })));
    assert.notEqual(base, computeFingerprint(makeQuery({ party: { adults: 2, children: 1 } })));
    assert.notEqual(base, computeFingerprint(makeQuery({ budget: 15000 })));
    assert.notEqual(base, computeFingerprint(makeQuery({ style: "luxury" })));
  });

  it("偏好不同则指纹不同", () => {
    assert.notEqual(
      computeFingerprint(makeQuery({ interests: ["美食"] })),
      computeFingerprint(makeQuery({ interests: ["美食", "摄影"] })),
    );
  });

  it("补充要求不同则指纹不同", () => {
    assert.notEqual(
      computeFingerprint(makeQuery({ notes: "带孩子" })),
      computeFingerprint(makeQuery({ notes: "不带孩子" })),
    );
  });

  it("指纹为定长十六进制字符串", () => {
    const value = computeFingerprint(makeQuery());

    assert.match(value, /^[0-9a-f]{32}$/);
  });
});
