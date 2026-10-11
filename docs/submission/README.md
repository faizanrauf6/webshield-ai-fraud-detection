# WebShield AI Submission Package

The final report and user manual describe the implemented controlled FYP prototype, measured results and research limits. All academic identity fields are conspicuously **SAMPLE / DEMONSTRATION** information requested for presentation. No student declaration, supervisor approval or academic acceptance has been signed.

| Document     | PDF                                  | Editable Word                          | Standalone HTML                        | Maintained source              |
| ------------ | ------------------------------------ | -------------------------------------- | -------------------------------------- | ------------------------------ |
| Final report | [PDF](WebShield_AI_Final_Report.pdf) | [DOCX](WebShield_AI_Final_Report.docx) | [HTML](WebShield_AI_Final_Report.html) | [Markdown](../FINAL_REPORT.md) |
| User manual  | [PDF](WebShield_AI_User_Manual.pdf)  | [DOCX](WebShield_AI_User_Manual.docx)  | [HTML](WebShield_AI_User_Manual.html)  | [Markdown](../USER_MANUAL.md)  |

Use the [deployment checklist](../DEPLOYMENT_CHECKLIST.md) for local setup and the [acceptance checklist](../ACCEPTANCE_CHECKLIST.md) to record a future independent human review. Original `WebShield_AI_FYP_Proposal.*` files are preserved separately. The supplied original proposal PDF outside the repository has not been rewritten.

## Rebuild the documents

Create a document-only environment or use an existing one, then run from the project root:

```bash
python3 -m venv /tmp/webshield-documents
/tmp/webshield-documents/bin/python -m pip install -r docs/submission/build-requirements.txt
/tmp/webshield-documents/bin/python scripts/build-submission.py
```

The generator embeds screenshots/diagrams, builds a paginated PDF contents page and produces independent final-report/manual exports. HTML files embed their images and can be opened offline. DOCX files retain editable text and tables. Source and asset changes require rebuilding before delivery.

[Sample cover metadata](sample-cover-metadata.json) records the requested dummy fields and unsigned approval status. [Submission manifest](submission-manifest.json) records SHA-256 checksums for exports, source text, cover metadata, image assets and preserved proposal exports. Generated artifacts are presentation outputs; full machine-readable experiment evidence remains under `docs/evidence/`.

The installed production model remains lexical phishing-only. Research candidates, reused-holdout improvements and small prospective pilots do not establish arbitrary-site or business-fraud accuracy. Negative results and unproven hypotheses remain explicit in the final report.
