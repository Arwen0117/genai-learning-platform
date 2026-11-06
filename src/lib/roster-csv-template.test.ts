import { describe, expect, it } from "vitest";

import { UTF8_BOM } from "@/lib/csv";
import {
  rosterCsvTemplateDocument,
  rosterCsvTemplateText,
} from "@/lib/roster-csv-template";

describe("roster CSV template", () => {
  it("includes the name,email header the importer accepts", () => {
    expect(rosterCsvTemplateText().split("\n")[0]).toBe("name,email");
    expect(rosterCsvTemplateDocument().startsWith(`${UTF8_BOM}name,email`)).toBe(
      true,
    );
  });

  it("keeps the preview and downloadable document on the same rows", () => {
    const previewRows = rosterCsvTemplateText().split("\n");
    const documentRows = rosterCsvTemplateDocument()
      .slice(UTF8_BOM.length)
      .trimEnd()
      .split("\r\n");
    expect(documentRows).toEqual(previewRows);
  });
});
