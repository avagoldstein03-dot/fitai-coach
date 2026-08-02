import { scaleToPoints } from "./scale";

describe("scaleToPoints", () => {
  it("returns an empty array for no values", () => {
    expect(scaleToPoints([], 100, 50)).toEqual([]);
  });

  it("centers a single value", () => {
    expect(scaleToPoints([42], 100, 50)).toEqual([{ x: 50, y: 25 }]);
  });

  it("maps the minimum to the bottom and maximum to the top", () => {
    const points = scaleToPoints([0, 10], 100, 50, 0);
    expect(points[0].y).toBe(50);
    expect(points[1].y).toBe(0);
  });

  it("spaces x evenly across the width", () => {
    const points = scaleToPoints([1, 2, 3], 100, 50);
    expect(points.map((p) => p.x)).toEqual([0, 50, 100]);
  });

  it("handles a flat series (all identical values) without dividing by zero", () => {
    const points = scaleToPoints([5, 5, 5], 100, 50, 0);
    expect(points.every((p) => Number.isFinite(p.y))).toBe(true);
  });
});
