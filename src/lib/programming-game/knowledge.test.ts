import { describe, expect, it } from "vitest";
import {
  getDefaultKnowledge,
  KNOWLEDGE_LIMITS,
  parseKnowledge,
} from "./knowledge";
import { TEMPLATES } from "./levels";

describe("level knowledge", () => {
  it.each(TEMPLATES.map((t) => t.id))(
    "provides independent bilingual cards for %s",
    (id) => {
      for (const locale of ["en", "zh"] as const) {
        const cards = getDefaultKnowledge(id, locale);
        expect(cards.length).toBeGreaterThan(0);
        expect(parseKnowledge(cards)).toEqual(cards);
        expect(
          cards.every((c) => c.title.length > 0 && c.body.length > 0),
        ).toBe(true);
        cards[0].body = "teacher modification";
        expect(getDefaultKnowledge(id, locale)[0].body).not.toBe(
          "teacher modification",
        );
      }
    },
  );
  it("permits no cards and incomplete editable drafts", () => {
    expect(parseKnowledge([])).toEqual([]);
    expect(parseKnowledge([{ title: "", body: "" }])).toEqual([
      { title: "", body: "" },
    ]);
  });
  it.each([null, {}, [{ title: 3, body: "text" }], [{ title: "title" }]])(
    "rejects invalid stored drafts %j",
    (value) => {
      expect(() => parseKnowledge(value)).toThrow("INVALID_KNOWLEDGE");
    },
  );
  it("bounds card count and text lengths", () => {
    expect(() =>
      parseKnowledge(
        Array.from({ length: KNOWLEDGE_LIMITS.cards + 1 }, () => ({
          title: "",
          body: "",
        })),
      ),
    ).toThrow();
    expect(() =>
      parseKnowledge([
        { title: "a".repeat(KNOWLEDGE_LIMITS.title + 1), body: "" },
      ]),
    ).toThrow();
    expect(() =>
      parseKnowledge([
        { title: "", body: "a".repeat(KNOWLEDGE_LIMITS.body + 1) },
      ]),
    ).toThrow();
  });
  it("copies only the supported plain-text fields", () => {
    const input = [
      { title: "<script>title</script>", body: "<b>body</b>", extra: true },
    ];
    const result = parseKnowledge(input);
    expect(result).toEqual([{ title: input[0].title, body: input[0].body }]);
    result[0].body = "changed";
    expect(input[0].body).toBe("<b>body</b>");
  });
});
