export function fitDeviceFrame(aspect: number, width: number, height: number) {
  if (width === 0 || height === 0) return { width: 0, height: 0 };
  const byHeight = { width: height * aspect, height };
  return byHeight.width <= width ? byHeight : { width, height: width / aspect };
}
