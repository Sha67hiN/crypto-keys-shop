import { ActionButton } from "./Pieces";
import { credentialsToCsv, credentialsToTxt, downloadFile } from "@/lib/store-format";

export function Credentials({ lines, name }: { lines: string[]; name: string }) {
  if (lines.length === 0) return null;
  const file = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return (
    <div className="space-y-3">
      <pre className="panel-solid max-h-72 overflow-auto rounded-lg p-3 font-mono text-xs text-snow">
        {lines.join("\n")}
      </pre>
      <div className="flex flex-wrap gap-2">
        <ActionButton variant="ghost" onClick={() => navigator.clipboard.writeText(lines.join("\n"))}>Copy</ActionButton>
        <ActionButton variant="ghost" onClick={() => downloadFile(`${file}.txt`, credentialsToTxt(lines), "text/plain")}>Download .txt</ActionButton>
        <ActionButton variant="ghost" onClick={() => downloadFile(`${file}.csv`, credentialsToCsv(lines), "text/csv")}>Download .csv</ActionButton>
      </div>
    </div>
  );
}
