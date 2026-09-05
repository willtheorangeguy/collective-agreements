# Collective Agreements — Roadmap

The repository currently has one explicit product limitation: multi-page scanned PDFs cannot be OCRed directly. PDF uploads with less than 200 non-whitespace characters of extracted text fail and must first be rasterized into supported image uploads. Image uploads are OCRed directly.

The system also depends on an externally configured static-site rebuild webhook after a worker finishes an analysis. Configure `REBUILD_WEBHOOK_URL` when deployment needs newly processed agreements to appear in a static build.

Implementation defects found during this documentation pass, including rebuild coverage after community edits, are tracked separately in [known issues](./internal/known-issues.md). They are not roadmap commitments.
