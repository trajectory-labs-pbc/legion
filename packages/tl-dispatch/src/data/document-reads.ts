// The reading aids' one file of reads: upstream's under its own keys, which its event refresh
// keeps fresh, and each baseline version under the aids' key, filled from upstream's version read.
import {
  hashKey,
  keepPreviousData,
  type QueryClient,
  type QueryState,
  queryOptions,
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { api } from "@/upstream/api";
import type { Artifact, IssueDetails, Version } from "@/upstream/contract";
import {
  type DispatchReferenceRoute,
  isText,
  type ProjectDocumentRoute,
  parseNodeReference,
  versionsNewestFirst,
} from "@/upstream/logic/reading-aids";
import { issueQuery } from "@/upstream/queries";

import { type ReadFault, refusalOf } from "./read";
import { useReadFailure } from "./read-failure";
import { readMarkKey } from "./read-marks";

// What the aids draw their rows and lines with, from upstream's contract and logic.
export type { IssueAskRow, IssueDetails, Version } from "@/upstream/contract";
export {
  actorLabelText,
  askTurnHolder,
  askUrgency,
  askWaitingOnPerson,
  buildDispatchReference,
  documentRoute,
  type TextSource,
  textSourceOf,
  URGENCY_LABELS,
  versionLabel,
} from "@/upstream/logic/reading-aids";

export type AidedOwner = { kind: "issue"; key: string } | { kind: "project"; project: string };

/** The document an aided editor shows, as the host page's reads name it. */
export interface AidedDocument {
  readonly artifactId: string;
  readonly slug: string;
  readonly owner: AidedOwner;
  /** Its versions, newest first. */
  readonly versions: readonly Version[];
  /** The version picker upstream draws above it: the issue's spec tab's, or an artifact's. */
  readonly picker: "spec" | "artifact";
  /** Whether upstream reads the reader's read mark of it: an issue's spec on its page. */
  readonly readsMark: boolean;
}

// The page's own observers keep these reads fresh, so the parts' mount reads nothing again.
const NO_REFETCH_ON_MOUNT = { refetchOnMount: false } as const;

/** The issue read the tabs issue page makes; also each of its documents' id and slug. */
export const useIssueRead = (key: string | undefined) =>
  useQuery({ ...issueQuery(key), enabled: key !== undefined, ...NO_REFETCH_ON_MOUNT });

/** The asks read `ProofDocument` makes for the document. */
const asksQuery = ({ artifactId, owner }: AidedDocument) =>
  queryOptions({
    queryKey: owner.kind === "issue" ? ["asks", owner.key] : ["artifact", artifactId, "asks"],
    queryFn: () =>
      owner.kind === "issue" ? api.listIssueAsks(owner.key) : api.listArtifactAsks(artifactId),
  });

export const useAsksRead = (document: AidedDocument) =>
  useQuery({ ...asksQuery(document), ...NO_REFETCH_ON_MOUNT });

/** The project document read `useProjectArtifact` makes, under its key. */
const useProjectDocumentRead = (route: ProjectDocumentRoute | undefined) =>
  useQuery({
    enabled: route !== undefined,
    queryKey: ["artifact-ref", `${route?.project}/${route?.slug}`],
    queryFn: () => {
      if (route === undefined) {
        throw new Error("Project document query requires a document route.");
      }
      return api.getProjectArtifact(route.project, route.slug);
    },
    ...NO_REFETCH_ON_MOUNT,
  });

/** A version of the document, read once: upstream's own read of it when it has one. */
const readVersion = (queryClient: QueryClient, artifactId: string, version: number) =>
  queryClient.ensureQueryData({
    queryFn: () => api.getArtifactVersion(artifactId, version),
    queryKey: ["artifact", artifactId, "version", version],
  });

/** The key of the aids' read of `version` of the document `artifactId`. */
export const baselineVersionKey = (artifactId: string, version: number | undefined) =>
  ["reading-aids", "baseline", artifactId, version] as const;

/**
 * The version the marks compare with, under the aids' own key: a version never changes, and
 * each one the visit opens stays for the visit; during a pick the last version shows. Its
 * `text` is undefined for a version that is a file.
 */
export function useBaselineVersionRead(artifactId: string, version: number | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    // A refused version is not asked again in the visit, so its refusal shows at once.
    enabled: (query) => refusalOf(query.state.error) === undefined,
    gcTime: Number.POSITIVE_INFINITY,
    placeholderData: keepPreviousData,
    queryFn:
      version === undefined
        ? skipToken
        : async () => {
            const content = await readVersion(queryClient, artifactId, version);
            const text = isText(content)
              ? { markdown: content.markdown, tree: content.markdown_tree }
              : undefined;
            return { text, version };
          },
    queryKey: baselineVersionKey(artifactId, version),
    // Upstream's version read retries as the app does; retrying here too would multiply it.
    retry: false,
    // A version never changes: no invalidation, mount or focus reads it again.
    staleTime: "static",
  });
}

/** The state of upstream's query under `queryKey`, which the aids watch and never read. */
function useQueryState<T>(queryKey: readonly unknown[]): QueryState<T> | undefined {
  const cache = useQueryClient().getQueryCache();
  const hash = hashKey(queryKey);
  const subscribe = useCallback(
    (listener: () => void) =>
      cache.subscribe((event) => {
        if (event.query.queryHash === hash) listener();
      }),
    [cache, hash]
  );
  return useSyncExternalStore(subscribe, () => cache.get<T>(hash)?.state);
}

/** The document `route` names, from the issue's documents or the project document read. */
export function aidedDocument(
  route: DispatchReferenceRoute | undefined,
  issue: Pick<IssueDetails, "artifacts"> | undefined,
  projectDocument: Pick<Artifact, "id" | "slug" | "versions"> | undefined
): AidedDocument | undefined {
  if (route?.kind === "document") {
    return projectDocument === undefined || projectDocument.slug !== route.slug
      ? undefined
      : {
          artifactId: projectDocument.id,
          owner: { kind: "project", project: route.project },
          picker: "artifact",
          readsMark: false,
          slug: route.slug,
          versions: versionsNewestFirst(projectDocument.versions),
        };
  }
  if (route?.kind !== "spec" && route?.kind !== "artifact") return undefined;
  const found = (issue?.artifacts ?? []).find((artifact) =>
    route.kind === "spec"
      ? artifact.primary && artifact.kind === "doc"
      : artifact.slug === route.slug
  );
  return found === undefined
    ? undefined
    : {
        artifactId: found.id,
        owner: { key: route.key, kind: "issue" },
        picker: route.kind === "spec" ? "spec" : "artifact",
        readsMark: found.primary,
        slug: found.slug,
        versions: versionsNewestFirst(found.versions),
      };
}

/** The document an aided editor shows, once the host page's read of it has answered. */
export function useAidedDocument(documentRef: string): AidedDocument | undefined {
  const route = useMemo(() => parseNodeReference(documentRef), [documentRef]);
  const issue = useIssueRead(
    route?.kind === "spec" || route?.kind === "artifact" ? route.key : undefined
  );
  const projectDocument = useProjectDocumentRead(route?.kind === "document" ? route : undefined);
  const found = useMemo(
    () => aidedDocument(route, issue.data, projectDocument.data),
    [route, issue.data, projectDocument.data]
  );
  // The document's own read, which `ProofDocument` makes, has the versions named since.
  const fresher = useQueryState<Artifact>(["artifact", found?.artifactId])?.data?.versions;
  return useMemo(
    () =>
      found === undefined || fresher == null
        ? found
        : { ...found, versions: versionsNewestFirst(fresher) },
    [found, fresher]
  );
}

/**
 * Upstream's read-mark read failing with no answer yet, whose Retry asks upstream's read again
 * and keeps the failure while it runs; a lasting refusal draws no Retry.
 */
export function useReadMarkFault(artifactId: string): ReadFault | undefined {
  const queryClient = useQueryClient();
  const state = useQueryState(readMarkKey(artifactId));
  return useReadFailure({
    data: state?.data,
    error: state?.error ?? null,
    fetchStatus: state?.fetchStatus ?? "idle",
    isPlaceholderData: false,
    queryKey: readMarkKey(artifactId),
    refetch: () => queryClient.refetchQueries({ exact: true, queryKey: readMarkKey(artifactId) }),
  });
}
