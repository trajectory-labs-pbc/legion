/** Control heights, in Tailwind spacing steps (1 step = 4 px): 24, 28, 32 and 36 px. */
export const CONTROL_HEIGHTS = { xs: 6, sm: 7, md: 8, lg: 9 } as const;

export type ControlSize = keyof typeof CONTROL_HEIGHTS;

/** The least height of a control on a coarse pointer: 44 px. */
export const TOUCH_MIN_HEIGHT = 11;

/** A checkbox or radio box: 14 or 16 px. */
export const CHECK_SIZES = [3.5, 4] as const;

/** Icon glyphs inside a control. */
export const GLYPH_SIZES = [3, 3.5, 4] as const;
