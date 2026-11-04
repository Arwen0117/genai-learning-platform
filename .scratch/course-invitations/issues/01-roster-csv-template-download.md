# 01: Downloadable roster CSV template

**What to build:** An Instructor on the Course roster import panel can download a CSV template with `name` and `email` columns and example rows, fill it in a spreadsheet, and import it with the existing CSV importer. The downloadable file and any on-page format hint share the same template content so they never disagree.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Course owner (or whoever can already use roster import) can download a UTF-8 CSV template from the import panel
- [x] Template header is `name,email` and includes example rows the importer accepts
- [x] On-page format hint uses the same template content as the download (no divergent examples)
- [x] Existing CSV import behaviour is unchanged
- [x] User-visible strings go through the existing i18n layer
