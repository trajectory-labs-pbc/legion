import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@legion/ui/components/select";
import { type AidedDocument, type Version, versionLabel } from "@/data/document-reads";

/** A version as the spec tab's picker names it, which upstream does not export. */
const specVersionLabel = ({ named, number, summary }: Version) =>
  `Version ${number}${named && summary !== null ? ` — ${summary}` : ""}`;

/** The version menu that picks the baseline the marks compare with. */
export function CompareWith({
  onChange,
  picker,
  value,
  versions,
}: {
  onChange: (version: number) => void;
  picker: AidedDocument["picker"];
  value: number | undefined;
  versions: readonly Version[];
}) {
  const label = picker === "spec" ? specVersionLabel : versionLabel;
  const items = versions.map((version) => ({
    label: label(version),
    value: String(version.number),
  }));
  return (
    <Select
      items={items}
      onValueChange={(picked) => {
        if (picked !== null) onChange(Number(picked));
      }}
      value={value === undefined ? null : String(value)}
    >
      <SelectTrigger aria-label="Compare with" size="sm">
        <SelectValue placeholder="Compare with" />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
