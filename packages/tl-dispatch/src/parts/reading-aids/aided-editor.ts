import {
  BLOCK_ID_ATTRIBUTE,
  type CreateEditor,
  createEditor,
  EDITOR_BOX_ATTRIBUTE,
  type EditorHandle,
} from "@/upstream/editor/frame";
import { importWhenOnline } from "@/upstream/shell";

/** The element the fork draws around a host page, which takes the focus after a move. */
export const HOST_ATTRIBUTE = "data-reading-aids-host";

type EditorAids = typeof import("./editor-aids");

/** Where an editor gets the aids: a host's editor that names a document, not an outline row's. */
function aidedPlace(
  root: HTMLElement,
  documentRef: string | undefined
): { host: HTMLElement; documentRef: string } | undefined {
  if (documentRef === undefined || root.closest(`[${EDITOR_BOX_ATTRIBUTE}]`) !== null) {
    return undefined;
  }
  const host = root.closest<HTMLElement>(`[${HOST_ATTRIBUTE}]`);
  return host === null ? undefined : { documentRef, host };
}

/** The id of the block that holds the mark's first span. */
function blockOfMark(view: EditorHandle["view"], markId: string): string | undefined {
  const span = view.dom.querySelector(`[data-id="${CSS.escape(markId)}"]`);
  return span?.closest(`[${BLOCK_ID_ATTRIBUTE}]`)?.getAttribute(BLOCK_ID_ATTRIBUTE) ?? undefined;
}

/** Upstream's handle: moves open folds first; block marks drop changed-since-read under marks. */
function aidedHandle(handle: EditorHandle, aids: EditorAids): EditorHandle {
  const { view } = handle;
  let hostMarks: Parameters<EditorHandle["setBlockMarks"]>[0] = [];
  let marksShown = false;
  const drawHostMarks = () => handle.setBlockMarks(aids.besideChangeMarks(view, hostMarks));
  aids.watchChanges(view, () => {
    if (aids.showsChangeMarks(view) === marksShown) return;
    marksShown = !marksShown;
    drawHostMarks();
  });
  return {
    ...handle,
    setBlockMarks(marks) {
      hostMarks = marks;
      drawHostMarks();
    },
    focusBlock(blockId) {
      aids.revealBlock(handle.view, blockId);
      handle.focusBlock(blockId);
    },
    focusMark(markId) {
      const blockId = blockOfMark(handle.view, markId);
      if (blockId !== undefined) aids.revealBlock(handle.view, blockId);
      handle.focusMark(markId);
    },
  };
}

/** The aids `load` answers, or none when it fails: a failed aid never hides the document. */
const aidsOrNone = (load: () => Promise<EditorAids>) =>
  load().catch((error: unknown) => {
    console.error("Dispatch: the reading aids failed to load", error);
    return undefined;
  });

/** Upstream's `createEditor`, with the aids `load` answers on a host's document editor. */
export const aidedEditor =
  (load: () => Promise<EditorAids>): CreateEditor =>
  async (root, options) => {
    const place = aidedPlace(root, options.documentRef);
    if (place === undefined) return createEditor(root, options);
    const [handle, aids] = await Promise.all([createEditor(root, options), aidsOrNone(load)]);
    if (aids === undefined) return handle;
    const aided = aidedHandle(handle, aids);
    const { plugins } = handle.view.state;
    try {
      aids.installAids(aided, place.host, place.documentRef);
      return aided;
    } catch (error) {
      console.error("Dispatch: the reading aids failed to install", error);
      // Upstream's plugins alone again; the parts' widget removes its entry as it goes.
      handle.view.updateState(handle.view.state.reconfigure({ plugins }));
      return handle;
    }
  };

export const createAidedEditor = aidedEditor(() => importWhenOnline(() => import("./editor-aids")));
