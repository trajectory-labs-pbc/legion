// The reading aids' one file of upstream's reads, each under upstream's own key, so its event
// refresh updates them and the page makes no request it would not make without them.
import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/upstream/api";
import type { Artifact, IssueDetails } from "@/upstream/contract";
import { type ProjectDocumentRoute, parseNodeReference } from "@/upstream/logic/reading-aids";
import { issueQuery } from "@/upstream/queries";

// What Read first draws its rows with, from upstream's contract and logic.
export type { IssueAskRow, IssueDetails } from "@/upstream/contract";
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
} from "@/upstream/logic/reading-aids";

export type AidedOwner = { kind: "issue"; key: string } | { kind: "project"; project: string };

/** The document an aided editor shows, as the host page's reads name it. */
export interface AidedDocument {
  readonly artifactId: string;
  readonly slug: string;
  readonly owner: AidedOwner;
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

/** The document `documentRef` names, from the issue's documents or the project document read. */
export function aidedDocument(
  documentRef: string,
  issue: Pick<IssueDetails, "artifacts"> | undefined,
  projectDocument: Pick<Artifact, "id" | "slug"> | undefined
): AidedDocument | undefined {
  const route = parseNodeReference(documentRef);
  if (route?.kind === "document") {
    return projectDocument === undefined || projectDocument.slug !== route.slug
      ? undefined
      : {
          artifactId: projectDocument.id,
          owner: { kind: "project", project: route.project },
          slug: route.slug,
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
    : { artifactId: found.id, owner: { key: route.key, kind: "issue" }, slug: found.slug };
}

/** The document an aided editor shows, once the host page's read of it has answered. */
export function useAidedDocument(documentRef: string): AidedDocument | undefined {
  const route = parseNodeReference(documentRef);
  const issue = useIssueRead(
    route?.kind === "spec" || route?.kind === "artifact" ? route.key : undefined
  );
  const projectDocument = useProjectDocumentRead(route?.kind === "document" ? route : undefined);
  return aidedDocument(documentRef, issue.data, projectDocument.data);
}
