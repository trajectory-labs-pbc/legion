import type { ReactNode, Ref } from "react";
import { isDrawn } from "#registry/legion/lib/utils";
import { Heading, HeadingSection } from "#registry/legion/ui/heading";
import { Label } from "#registry/legion/ui/label";
import { Text } from "#registry/legion/ui/text";

/** One section of a settings page: a region named by its heading, with an optional description
 *  and controls at the right of the heading, then its body. A section right after
 *  another section has a 1 px line above it, with 16 px on each side (SU4). `id` is the anchor
 *  `#<id>` opens. */
function SettingsSection({
  id,
  title,
  description,
  end,
  children,
  ref,
}: {
  /** The anchor; the heading takes `<id>-heading`. */
  id: string;
  title: ReactNode;
  /** Muted text under the heading: one line, or a folded explanation such as a `Collapsible`. */
  description?: ReactNode;
  /** Controls at the right of the heading. */
  end?: ReactNode;
  /** The body: rows, a table, a form ending in a `SettingsFoot`. Its headings rank under the
   *  section's. */
  children: ReactNode;
  ref?: Ref<HTMLElement>;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 [[data-slot=settings-section]+&]:mt-4 [[data-slot=settings-section]+&]:border-t [[data-slot=settings-section]+&]:pt-4"
      data-slot="settings-section"
      id={id}
      ref={ref}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Heading id={headingId} size="section">
            {title}
          </Heading>
          {isDrawn(description) ? (
            <Text render={<div />} tone="muted">
              {description}
            </Text>
          ) : null}
        </div>
        {isDrawn(end) ? <div className="flex shrink-0 items-center gap-1">{end}</div> : null}
      </div>
      <HeadingSection>{children}</HeadingSection>
    </section>
  );
}

/** The last part of a settings form: its primary action (`children`), then a muted note about
 *  it, in one row. */
function SettingsFoot({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3" data-slot="settings-foot">
      {children}
      {isDrawn(note) ? (
        <Text size="caption" tone="muted">
          {note}
        </Text>
      ) : null}
    </div>
  );
}

/** What a row hands its control: the id its label names, and the ids of its description and its
 *  error, which the control reads as its description. */
interface SettingsControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

/** One setting: its label and description at the left, its one control at the right with an
 *  error line under it; stacked on a narrow screen. The error's region is always drawn, so a
 *  reader hears an error once when it appears or changes (TO3: a failure is an alert). */
function SettingsRow({
  id,
  label,
  description,
  error,
  children,
}: {
  /** The control's id. */
  id: string;
  label: ReactNode;
  description?: ReactNode;
  /** One line under the control, such as a refused write. */
  error?: ReactNode;
  /** Draws the one control with the props it is given. */
  children: (control: SettingsControlProps) => ReactNode;
}) {
  const descriptionId = isDrawn(description) ? `${id}-description` : undefined;
  const errorId = isDrawn(error) ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
      data-slot="settings-row"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        {descriptionId === undefined ? null : (
          <Text id={descriptionId} render={<p />} size="caption" tone="muted">
            {description}
          </Text>
        )}
      </div>
      <div className="flex min-w-0 flex-col sm:w-1/2">
        <div className="flex sm:justify-end">
          {children({
            id,
            "aria-describedby": describedBy,
            "aria-invalid": errorId === undefined ? undefined : true,
          })}
        </div>
        <div role="alert">
          {errorId === undefined ? null : (
            <Text className="mt-1 text-danger" id={errorId} render={<p />} size="caption">
              {error}
            </Text>
          )}
        </div>
      </div>
    </div>
  );
}

export { type SettingsControlProps, SettingsFoot, SettingsRow, SettingsSection };
