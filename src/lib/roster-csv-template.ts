import { toCsvDocument } from "@/lib/csv";

/**
 * Shared roster CSV template for the import panel hint and the downloadable
 * file. One source so the on-page example and the spreadsheet never disagree.
 */
export const ROSTER_CSV_TEMPLATE_ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ["name", "email"],
  ["Ada Lovelace", "ada.lovelace@example.com"],
  ["Alan Turing", "alan.turing@example.com"],
  ["Grace Hopper", "grace.hopper@example.com"],
];

/** Plain-text preview shown in the import panel `<details>` block. */
export function rosterCsvTemplateText(): string {
  return ROSTER_CSV_TEMPLATE_ROWS.map((row) => row.join(",")).join("\n");
}

/** UTF-8 CSV (with BOM) for Excel / Sheets download. */
export function rosterCsvTemplateDocument(): string {
  return toCsvDocument(ROSTER_CSV_TEMPLATE_ROWS);
}
