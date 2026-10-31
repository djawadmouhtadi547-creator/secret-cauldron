/**
 * Validates per-instance resolution overrides before substituting them into
 * Mojang's argument tokens. Invalid or partial dimensions fall back safely.
 */
export function normalizeResolution(options = {}) {
  const widthValue = Number(options.overrideWidth);
  const heightValue = Number(options.overrideHeight);
  const hasWidth = options.overrideWidth !== undefined && options.overrideWidth !== null
    && String(options.overrideWidth).trim() !== ''
    && Number.isInteger(widthValue) && widthValue >= 640 && widthValue <= 7680;
  const hasHeight = options.overrideHeight !== undefined && options.overrideHeight !== null
    && String(options.overrideHeight).trim() !== ''
    && Number.isInteger(heightValue) && heightValue >= 360 && heightValue <= 4320;
  return {
    width: hasWidth ? widthValue : 1280,
    height: hasHeight ? heightValue : 720,
    overrideWidth: hasWidth ? widthValue : null,
    overrideHeight: hasHeight ? heightValue : null
  };
}
