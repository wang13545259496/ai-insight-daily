import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAJOR_STATIONS,
  STATION_SCORE,
  isMajorRoute,
  stationScore,
  trainPriorityScore,
} from "./stationRank";

/**
 * 枢纽站评分测试。
 *
 * 这段逻辑修的是实测问题：「上海→杭州」按价格排序时，
 * 最便宜的方案是上海松江（远郊）发车，而用户预期的是虹桥。
 */

describe("travel/stationRank 车站枢纽度", () => {
  it("主要车站得最高分", () => {
    assert.equal(stationScore("上海虹桥", "上海"), STATION_SCORE.major);
    assert.equal(stationScore("北京南", "北京"), STATION_SCORE.major);
    assert.equal(stationScore("杭州东", "杭州"), STATION_SCORE.major);
    assert.equal(stationScore("广州南", "广州"), STATION_SCORE.major);
  });

  it("★ 郊区站得分显著低于枢纽站（回归：曾把松江排到虹桥前）", () => {
    const hongqiao = stationScore("上海虹桥", "上海");
    const songjiang = stationScore("上海松江", "上海");
    const jinshan = stationScore("金山北", "上海");

    assert.ok(songjiang < hongqiao, `松江 ${songjiang} 应低于虹桥 ${hongqiao}`);
    assert.ok(jinshan < hongqiao, `金山北 ${jinshan} 应低于虹桥 ${hongqiao}`);
    assert.equal(songjiang, STATION_SCORE.suburban);
  });

  it("不在清单但带方位后缀的站得中等分", () => {
    assert.equal(stationScore("某某东", "某某城"), STATION_SCORE.directional);
    assert.equal(stationScore("某某南", "某某城"), STATION_SCORE.directional);
  });

  it("无法判断的站得默认分", () => {
    assert.equal(stationScore("某某站", "某某城"), STATION_SCORE.unknown);
  });

  it("空站名得 0 分", () => {
    assert.equal(stationScore("", "上海"), 0);
  });

  it("清单覆盖主要城市", () => {
    const cities = Object.keys(MAJOR_STATIONS);

    assert.ok(cities.length >= 40, `仅覆盖 ${cities.length} 个城市`);

    for (const c of ["北京", "上海", "广州", "深圳", "杭州", "成都", "西安"]) {
      assert.ok(cities.includes(c), `缺少 ${c}`);
      assert.ok(MAJOR_STATIONS[c].length >= 2, `${c} 的车站过少`);
    }
  });
});

describe("travel/stationRank 车次优先级", () => {
  const base = {
    originCity: "上海",
    destinationCity: "杭州",
    durationMinutes: 60,
    price: 60,
  };

  it("★ 枢纽站车次胜过郊区站车次（即使后者更便宜）", () => {
    const hub = trainPriorityScore({
      ...base,
      fromStation: "上海虹桥",
      toStation: "杭州东",
      trainNumber: "G1",
      price: 73,
      durationMinutes: 45,
    });

    const suburb = trainPriorityScore({
      ...base,
      fromStation: "上海松江",
      toStation: "杭州",
      trainNumber: "K1",
      price: 23.5,
      durationMinutes: 116,
    });

    assert.ok(hub > suburb, `虹桥 ${hub} 应高于松江 ${suburb}`);
  });

  it("高铁比同条件的普速得分高", () => {
    const g = trainPriorityScore({
      ...base,
      fromStation: "上海虹桥",
      toStation: "杭州东",
      trainNumber: "G1",
      price: 73,
    });

    const k = trainPriorityScore({
      ...base,
      fromStation: "上海虹桥",
      toStation: "杭州东",
      trainNumber: "K1",
      price: 73,
    });

    assert.ok(g > k, `高铁 ${g} 应高于普速 ${k}`);
  });

  it("同等条件下便宜的得分更高", () => {
    const cheap = trainPriorityScore({
      ...base,
      fromStation: "上海虹桥",
      toStation: "杭州东",
      trainNumber: "G1",
      price: 60,
    });

    const pricey = trainPriorityScore({
      ...base,
      fromStation: "上海虹桥",
      toStation: "杭州东",
      trainNumber: "G1",
      price: 200,
    });

    assert.ok(cheap > pricey);
  });

  it("同等条件下快的得分更高", () => {
    const fast = trainPriorityScore({
      ...base,
      fromStation: "上海虹桥",
      toStation: "杭州东",
      trainNumber: "G1",
      durationMinutes: 45,
    });

    const slow = trainPriorityScore({
      ...base,
      fromStation: "上海虹桥",
      toStation: "杭州东",
      trainNumber: "G1",
      durationMinutes: 200,
    });

    assert.ok(fast > slow);
  });

  it("一端枢纽一端郊区时得分居中（不因单端是枢纽就满分）", () => {
    const bothHub = trainPriorityScore({
      ...base,
      fromStation: "上海虹桥",
      toStation: "杭州东",
      trainNumber: "G1",
    });

    const oneHub = trainPriorityScore({
      ...base,
      fromStation: "上海虹桥",
      toStation: "临平南",
      trainNumber: "G1",
    });

    assert.ok(bothHub > oneHub, "双枢纽应高于单枢纽");
  });
});

describe("travel/stationRank 枢纽线路判断", () => {
  it("两端都是主要车站时为 true", () => {
    assert.equal(isMajorRoute("上海虹桥", "北京南", "上海", "北京"), true);
    assert.equal(isMajorRoute("上海虹桥", "杭州东", "上海", "杭州"), true);
  });

  it("任一端不是主要车站时为 false", () => {
    assert.equal(isMajorRoute("上海松江", "杭州", "上海", "杭州"), false);
    assert.equal(isMajorRoute("上海虹桥", "临平南", "上海", "杭州"), false);
  });
});
