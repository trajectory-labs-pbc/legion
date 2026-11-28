import type { ReactNode } from "react";

import { isDrawn } from "#registry/legion/lib/utils";

/** A record's page (IV1): the header, the properties panel and the body. From 1024 px the panel is
 *  a 280 px column at the right, with a line at its left, from the top of the header to the
 *  bottom, and the header and the body are the main column. Below 1024 px the panel is under the
 *  header, with a line and a 12 px gap under it. The document's order is the header, the panel,
 *  then the body, so Tab follows the order in which they are drawn below 1024 px. The body and the
 *  panel each scroll on their own (FR4). It fills its flex column. */
function RecordView({
  header,
  panel,
  children,
}: {
  /** A `RecordHeader`. */
  header: ReactNode;
  /** A `PropertiesPanel`; none while the page hides it. */
  panel?: ReactNode;
  /** The body: the description, the record's children, its activity. */
  children: ReactNode;
}) {
  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[auto_minmax(0,1fr)]"
      data-slot="record-view"
    >
      <div className="row-start-1 min-w-0 lg:col-start-1">{header}</div>
      {isDrawn(panel) ? (
        <div
          className="row-start-2 min-w-0 max-lg:mb-3 max-lg:border-b max-lg:border-border lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:w-70 lg:overflow-y-auto lg:border-l lg:border-border"
          data-slot="record-view-panel"
        >
          {panel}
        </div>
      ) : null}
      <div
        className="row-start-3 min-h-0 min-w-0 overflow-y-auto px-6 pb-6 lg:col-start-1 lg:row-start-2"
        data-slot="record-view-body"
      >
        {children}
      </div>
    </div>
  );
}

export { RecordView };
