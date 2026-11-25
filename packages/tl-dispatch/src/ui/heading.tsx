import { type ComponentProps, createContext, type ReactNode, useContext, useMemo } from "react";

import { type HeadingSize, headingVariants, type Tone } from "@/ui/lib/typography";
import { cn } from "@/ui/lib/utils";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface Outline {
  /** The rank of the surface's title: a page or an overlay. */
  title: HeadingLevel;
  /** The rank of a heading at this place. */
  level: HeadingLevel;
}

const NEXT_LEVEL: Record<HeadingLevel, HeadingLevel | undefined> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: undefined };

// The page title is the one h1, so a page body starts at h2.
const OutlineContext = createContext<Outline>({ title: 1, level: 2 });

// An overlay's title ranks under the page title, so its body starts at h3.
const OVERLAY_OUTLINE: Outline = { title: 2, level: 3 };

interface HeadingProps extends ComponentProps<"h2"> {
  /** The look. The rank comes from the nesting, never from a prop. */
  size: HeadingSize;
  tone?: Tone;
}

function Heading({ size, tone, className, ...props }: HeadingProps) {
  const Tag = `h${useContext(OutlineContext).level}` as const;
  return <Tag data-slot="heading" className={cn(headingVariants({ size, tone }), className)} {...props} />;
}

/** Ranks the headings inside one level under the heading before them. */
function HeadingSection({ children }: { children: ReactNode }) {
  const outline = useContext(OutlineContext);
  const level = NEXT_LEVEL[outline.level];
  if (level === undefined) {
    throw new Error("The heading outline is deeper than h6.");
  }
  const value = useMemo(() => ({ ...outline, level }), [outline, level]);
  return <OutlineContext.Provider value={value}>{children}</OutlineContext.Provider>;
}

/** The surface's title element. An overlay passes it to its Base UI title's `render` prop. */
function SurfaceTitleElement(props: ComponentProps<"h2">) {
  const Tag = `h${useContext(OutlineContext).title}` as const;
  return <Tag {...props} />;
}

/** The surface's title: a page's h1, or a dialog's or a sheet's h2. */
function SurfaceTitle({ size, tone, className, ...props }: HeadingProps) {
  return (
    <SurfaceTitleElement data-slot="heading" className={cn(headingVariants({ size, tone }), className)} {...props} />
  );
}

/** Starts an overlay body's outline, whatever the level that opened the overlay. */
function OverlayOutline({ children }: { children: ReactNode }) {
  return <OutlineContext.Provider value={OVERLAY_OUTLINE}>{children}</OutlineContext.Provider>;
}

export { Heading, type HeadingProps, HeadingSection, OverlayOutline, SurfaceTitle, SurfaceTitleElement };
