import type { ReactNode } from "react";
import { textVariants } from "#registry/legion/lib/typography";
import { SurfaceTitle } from "#registry/legion/ui/heading";

/** A page that stands in for the app: who it is from, a title, and what to do next. */
function MessagePage({
  eyebrow,
  title,
  children,
}: {
  /** The app's name, above the title. */
  eyebrow: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main
      data-slot="message-page"
      className="grid min-h-dvh place-items-center bg-background px-6 text-foreground"
    >
      <section className="w-full max-w-md border bg-card p-8 text-card-foreground">
        <p className={textVariants({ tone: "muted", weight: "medium" })}>{eyebrow}</p>
        <SurfaceTitle className="mt-3" size="page">
          {title}
        </SurfaceTitle>
        {children}
      </section>
    </main>
  );
}

export { MessagePage };
