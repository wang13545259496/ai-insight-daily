import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isVariflightConfigured, lowestPrice, pythonDictToJson } from "./variflight";
import type { VariflightFlight } from "./variflight";

/**
 * 飞常准客户端测试。
 *
 * 重点是 pythonDictToJson —— 接口返回的不是 JSON 而是 Python dict 字面量，
 * 解析出错会导致整条报价链失效，因此覆盖各种边界。
 */

describe("travel/variflight 配置检查", () => {
  it("未配置 Key 时返回 false", () => {
    const original = process.env.VARIFLIGHT_API_KEY;
    delete process.env.VARIFLIGHT_API_KEY;

    assert.equal(isVariflightConfigured(), false);

    if (original !== undefined) process.env.VARIFLIGHT_API_KEY = original;
  });
});

describe("travel/variflight pythonDictToJson 解析", () => {
  it("基本结构：单引号 + 无引号键", () => {
    const json = pythonDictToJson("{'code': 200, 'message': 'Success'}");
    const obj = JSON.parse(json);

    assert.equal(obj.code, 200);
    assert.equal(obj.message, "Success");
  });

  it("去掉前缀说明文字", () => {
    const json = pythonDictToJson("Flight prices: {'code': 200, 'data': []}");
    const obj = JSON.parse(json);

    assert.equal(obj.code, 200);
  });

  it("True / False / None 转为字面量", () => {
    const json = pythonDictToJson("{'a': True, 'b': False, 'c': None}");
    const obj = JSON.parse(json);

    assert.equal(obj.a, true);
    assert.equal(obj.b, false);
    assert.equal(obj.c, null);
  });

  it("字符串内的撇号不被误识别为结束引号", () => {
    const json = pythonDictToJson("{'name': \"don't stop\", 'x': 1}");
    const obj = JSON.parse(json);

    assert.equal(obj.x, 1);
    assert.ok(obj.name.includes("don"));
  });

  it("字符串内的双引号被正确转义", () => {
    const json = pythonDictToJson("{'name': 'say \"hi\"', 'x': 2}");
    const obj = JSON.parse(json);

    assert.equal(obj.x, 2);
    assert.ok(obj.name.includes("hi"));
  });

  it("嵌套数组与对象", () => {
    const json = pythonDictToJson(
      "{'data': [{'flightno': 'MU5160', 'cabins': [{'price': 564}]}]}",
    );
    const obj = JSON.parse(json);

    assert.equal(obj.data[0].flightno, "MU5160");
    assert.equal(obj.data[0].cabins[0].price, 564);
  });

  it("中文内容保持完整", () => {
    const json = pythonDictToJson("{'depaptcname': '北京首都', 'arraptcname': '上海虹桥'}");
    const obj = JSON.parse(json);

    assert.equal(obj.depaptcname, "北京首都");
    assert.equal(obj.arraptcname, "上海虹桥");
  });

  it("真实响应片段能完整解析（回归用例）", () => {
    const sample =
      "Flight prices: {'code': 200, 'message': 'Success', 'data': [{'flightcompany': 'MU', " +
      "'flightno': 'MU5160', 'flightdepcode': 'PEK', 'flightarrcode': 'SHA', 'depaptcname': '北京首都', " +
      "'arraptcname': '上海虹桥', 'depcitycode': 'BJS', 'depdate': '2026-10-29', 'distance': 1178, " +
      "'stopflag': 0, 'cabins': [{'cabinclass': 'Y', 'classname': '经济舱', 'cabincode': 'T', " +
      "'seatnum': 2, 'stprice': 2150, 'price': 564, 'discount': 0.26}]}]}";

    const obj = JSON.parse(pythonDictToJson(sample));
    const flight = obj.data[0];

    assert.equal(obj.code, 200);
    assert.equal(flight.flightno, "MU5160");
    assert.equal(flight.distance, 1178);
    assert.equal(flight.cabins[0].classname, "经济舱");
    assert.equal(flight.cabins[0].price, 564);
    assert.equal(flight.cabins[0].discount, 0.26);
  });
});

function makeFlight(over: Partial<VariflightFlight> = {}): VariflightFlight {
  return {
    flightNumber: "MU5160",
    airline: "MU",
    depAirport: "北京首都",
    arrAirport: "上海虹桥",
    depCode: "PEK",
    arrCode: "SHA",
    departAt: null,
    arriveAt: null,
    distance: 1178,
    hasStop: false,
    cabins: [],
    ...over,
  };
}

describe("travel/variflight 最低价查询", () => {
  it("在多个航班与舱位中取最低——经济舱", () => {
    const flights = [
      makeFlight({
        flightNumber: "A1",
        cabins: [
          { cabinClass: "Y", className: "经济舱", cabinCode: "T", discount: null, price: 800, standardPrice: null, seats: null },
        ],
      }),
      makeFlight({
        flightNumber: "B2",
        cabins: [
          { cabinClass: "Y", className: "经济舱", cabinCode: "V", discount: null, price: 350, standardPrice: null, seats: null },
          { cabinClass: "C", className: "公务舱", cabinCode: "I", discount: null, price: 2632, standardPrice: null, seats: null },
        ],
      }),
    ];

    const best = lowestPrice(flights, "经济");

    assert.equal(best?.price, 350);
    assert.equal(best?.flight.flightNumber, "B2");
  });

  it("按舱位筛选——公务舱", () => {
    const flights = [
      makeFlight({
        cabins: [
          { cabinClass: "Y", className: "经济舱", cabinCode: "T", discount: null, price: 350, standardPrice: null, seats: null },
          { cabinClass: "C", className: "公务舱", cabinCode: "I", discount: null, price: 2632, standardPrice: null, seats: null },
        ],
      }),
    ];

    const best = lowestPrice(flights, "公务");

    assert.equal(best?.price, 2632);
  });

  it("无匹配舱位时返回 null", () => {
    const flights = [
      makeFlight({
        cabins: [
          { cabinClass: "Y", className: "经济舱", cabinCode: "T", discount: null, price: 350, standardPrice: null, seats: null },
        ],
      }),
    ];

    assert.equal(lowestPrice(flights, "头等"), null);
  });

  it("空列表返回 null", () => {
    assert.equal(lowestPrice([], "经济"), null);
  });

  it("跳过价格非正的舱位", () => {
    const flights = [
      makeFlight({
        cabins: [
          { cabinClass: "Y", className: "经济舱", cabinCode: "T", discount: null, price: 0, standardPrice: null, seats: null },
        ],
      }),
    ];

    assert.equal(lowestPrice(flights, "经济"), null);
  });
});
