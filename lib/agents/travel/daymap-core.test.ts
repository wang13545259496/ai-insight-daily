import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DAY_MAP_HEIGHT,
  DAY_MAP_WIDTH,
  buildDayMapModel,
  fitDayView,
  parseLocation,
  projectToPixel,
  simplifyPathPixels,
} from "./daymap-core";
import type { ItineraryDay } from "./types";

/**
 * 逐日地图的纯计算层测试。
 *
 * 重点覆盖三件事 —— 它们出错时页面只是「图看起来怪」，很难定位：
 *   1. 编号与活动顺序一致，同一坐标合并成一个编号
 *   2. 取景能把当天所有点装进画布（写死 zoom 就是在这里翻车的）
 *   3. 投影：中心点必须落在画布正中
 */

/** 造一天的活动 */
function day(activities: Array<{ title: string; coordinates?: string }>): ItineraryDay {
  return {
    day: 1,
    date: "2026-10-24",
    theme: "测试",
    estimatedCost: 0,
    accommodation: "—",
    activities: activities.map((item) => ({
      startTime: "09:00",
      endTime: "10:00",
      title: item.title,
      kind: "sight" as const,
      description: "",
      estimatedCost: 0,
      costSource: "estimate" as const,
      coordinates: item.coordinates,
    })),
  };
}

describe("travel/daymap 坐标解析", () => {
  it("合法坐标解析为数字对", () => {
    assert.deepEqual(parseLocation("116.397029,39.917839"), [116.397029, 39.917839]);
  });

  it("非法与越界坐标返回 null", () => {
    assert.equal(parseLocation(""), null);
    assert.equal(parseLocation(undefined), null);
    assert.equal(parseLocation("116.397"), null);
    assert.equal(parseLocation("abc,def"), null);
    assert.equal(parseLocation("200,30"), null);
    assert.equal(parseLocation("120,100"), null);
  });
});

describe("travel/daymap 编号", () => {
  it("按活动顺序从 1 编号", () => {
    const model = buildDayMapModel(
      day([
        { title: "故宫", coordinates: "116.397029,39.917839" },
        { title: "景山", coordinates: "116.396551,39.925875" },
        { title: "北海", coordinates: "116.391802,39.928775" },
      ]),
    );

    assert.deepEqual(
      model.stops.map((stop) => stop.number),
      [1, 2, 3],
    );
    assert.deepEqual(model.activityNumbers, [1, 2, 3]);
  });

  it("★ 同一坐标合并成一个编号，两条活动共享它", () => {
    const model = buildDayMapModel(
      day([
        { title: "前往天坛", coordinates: "116.410829,39.881913" },
        { title: "天坛公园", coordinates: "116.410829,39.881913" },
        { title: "国博", coordinates: "116.401304,39.905374" },
      ]),
    );

    assert.equal(model.stops.length, 2, "同一坐标只应占一个标注点");
    assert.deepEqual(model.activityNumbers, [1, 1, 2]);
    assert.deepEqual(model.stops[0].activityIndexes, [0, 1]);
  });

  it("无坐标的活动不参与编号，也不产生空号", () => {
    const model = buildDayMapModel(
      day([
        { title: "前往机场" },
        { title: "故宫", coordinates: "116.397029,39.917839" },
        { title: "打车回酒店" },
        { title: "景山", coordinates: "116.396551,39.925875" },
      ]),
    );

    assert.deepEqual(model.activityNumbers, [null, 1, null, 2]);
    assert.deepEqual(
      model.stops.map((stop) => stop.number),
      [1, 2],
    );
  });

  it("坐标相近但不同（1 米以上差异）不合并", () => {
    const model = buildDayMapModel(
      day([
        { title: "甲", coordinates: "116.397029,39.917839" },
        { title: "乙", coordinates: "116.397129,39.917839" },
      ]),
    );

    assert.equal(model.stops.length, 2);
  });
});

describe("travel/daymap 取景", () => {
  /** 北京：大兴机场 → 顺义，横向约 60 公里，是「写死 zoom 会翻车」的典型 */
  const BEIJING_DAY: Array<[number, number]> = [
    [116.429172, 39.510561],
    [116.407387, 39.904179],
    [116.574114, 40.042789],
  ];

  it("★ 跨度大时缩小级别，所有点仍在画布内", () => {
    const view = fitDayView(BEIJING_DAY);

    assert.ok(view, "应得到取景");

    for (const point of BEIJING_DAY) {
      const [x, y] = projectToPixel(point[0], point[1], view);

      assert.ok(x >= 0 && x <= DAY_MAP_WIDTH, `x=${x} 应在画布内`);
      assert.ok(y >= 0 && y <= DAY_MAP_HEIGHT, `y=${y} 应在画布内`);
    }

    // 60 公里跨度不可能用 13 级装进 720×405
    assert.ok(view.zoom < 13, `级别 ${view.zoom} 应小于 13`);
  });

  it("点位集中时用较大级别（看清街区）", () => {
    const view = fitDayView([
      [116.397029, 39.917839],
      [116.397659, 39.896269],
      [116.396551, 39.925875],
    ]);

    assert.ok(view);
    assert.ok(view.zoom >= 13, `级别 ${view.zoom} 应不小于 13`);
  });

  it("★ 两点几乎重合时按单点处理（活动坐标与折线首点的微小偏差）", () => {
    const view = fitDayView([
      [116.565052, 40.431668],
      [116.565061, 40.431672],
    ]);

    assert.ok(view);
    assert.equal(view.zoom, 15, "几米偏差不应把级别顶到 17");
  });

  it("单点用固定级别，且不会一路放大到贴着屋顶", () => {
    const view = fitDayView([[116.397029, 39.917839]]);

    assert.ok(view);
    assert.equal(view.zoom, 15);
  });

  it("空点集返回 null", () => {
    assert.equal(fitDayView([]), null);
  });

  it("取景中心投影到画布正中", () => {
    const view = fitDayView(BEIJING_DAY);

    assert.ok(view);
    const [x, y] = projectToPixel(view.center[0], view.center[1], view);

    assert.ok(Math.abs(x - DAY_MAP_WIDTH / 2) < 0.01, `x=${x}`);
    assert.ok(Math.abs(y - DAY_MAP_HEIGHT / 2) < 0.01, `y=${y}`);
  });
});

describe("travel/daymap 折线简化", () => {
  it("不足两个点时原样返回", () => {
    assert.deepEqual(simplifyPathPixels([[1, 1]]), [[1, 1]]);
    assert.deepEqual(simplifyPathPixels([]), []);
  });

  it("★ 抽稀后仍保留首尾点", () => {
    const points: Array<[number, number]> = Array.from({ length: 200 }, (_, i) => [i * 0.4, i * 0.4]);
    const kept = simplifyPathPixels(points, 2);

    assert.ok(kept.length < points.length, "应减少点数");
    assert.deepEqual(kept[0], points[0]);
    assert.deepEqual(kept[kept.length - 1], points[points.length - 1]);
  });

  it("相距小于阈值的点被丢弃", () => {
    const kept = simplifyPathPixels(
      [
        [0, 0],
        [0.5, 0],
        [1, 0],
        [50, 0],
      ],
      2,
    );

    assert.deepEqual(kept, [
      [0, 0],
      [50, 0],
    ]);
  });
});
