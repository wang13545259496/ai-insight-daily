import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CityResolveError, looksLikeIata, resolveCity, resolveTripCities } from "./cities";

describe("travel/cities 城市解析", () => {
  it("中文城市名映射到城市码", () => {
    assert.equal(resolveCity("北京")?.code, "BJS");
    assert.equal(resolveCity("上海")?.code, "SHA");
    assert.equal(resolveCity("东京")?.code, "TYO");
    assert.equal(resolveCity("曼谷")?.code, "BKK");
  });

  it("英文名不区分大小写", () => {
    assert.equal(resolveCity("Tokyo")?.code, "TYO");
    assert.equal(resolveCity("BANGKOK")?.code, "BKK");
  });

  it("带「市」后缀仍可识别", () => {
    assert.equal(resolveCity("北京市")?.code, "BJS");
    assert.equal(resolveCity("杭州市")?.code, "HGH");
  });

  it("直接填三字码时原样采用并标记为未收录", () => {
    const resolved = resolveCity("AKL");

    assert.equal(resolved?.code, "AKL");
    assert.equal(resolved?.matched, true, "AKL 在表内，应命中");

    const unknown = resolveCity("ZZZ");

    assert.equal(unknown?.code, "ZZZ");
    assert.equal(unknown?.matched, false);
  });

  it("无法识别的城市名返回 null", () => {
    assert.equal(resolveCity("不存在的城市名"), null);
    assert.equal(resolveCity(""), null);
  });

  it("looksLikeIata 只认三位字母", () => {
    assert.equal(looksLikeIata("PEK"), true);
    assert.equal(looksLikeIata("pek"), true);
    assert.equal(looksLikeIata("PEKX"), false);
    assert.equal(looksLikeIata("北京"), false);
  });

  it("出发地无法识别时抛出带提示的错误", () => {
    assert.throws(
      () => resolveTripCities("某个小城", "东京"),
      (error: unknown) =>
        error instanceof CityResolveError && error.message.includes("三字码"),
    );
  });

  it("目的地无法识别时同样抛错", () => {
    assert.throws(() => resolveTripCities("北京", "某个小城"), CityResolveError);
  });

  it("两地都能识别时返回完整结果", () => {
    const { origin, destination } = resolveTripCities("北京", "三亚");

    assert.equal(origin.code, "BJS");
    assert.equal(destination.code, "SYX");
  });
});
