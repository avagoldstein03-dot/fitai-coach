export interface ScaledPoint {
  x: number;
  y: number;
}

// Linearly maps {x: index, y: value} data onto pixel coordinates within
// [0, width] x [0, height], flipping y since SVG's origin is top-left.
export function scaleToPoints(
  values: number[],
  width: number,
  height: number,
  paddingY: number = 8
): ScaledPoint[] {
  if (values.length === 0) return [];
  if (values.length === 1) {
    return [{ x: width / 2, y: height / 2 }];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const usableHeight = height - paddingY * 2;
  const stepX = width / (values.length - 1);

  return values.map((v, i) => ({
    x: i * stepX,
    y: paddingY + usableHeight - ((v - min) / range) * usableHeight,
  }));
}
