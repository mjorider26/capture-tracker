# Documents foundation — Phase 10A

Phase 10A stores fictional document metadata only. It has no file input, bytes, previews, downloads, provider URLs, R2/S3 configuration, credentials, network storage calls, OCR, or scanning provider.

Documents are business-scoped and use a normalized SHA-256 metadata hash unique per business. The same synthetic hash may exist in another business. Creation is transactional and records exactly one immutable initial `PENDING_VALIDATION` history event; pending documents can become `ACTIVE` or `QUARANTINED` only. Active and quarantined documents are terminal.

The Capture Tracker retention target is seven calendar years from the document date (or creation baseline). This is a product target, not legal or tax advice. Storage is always `METADATA_ONLY`; the disabled storage boundary fails closed.

The local demo creates deterministic synthetic records only. Phase 10B requires separate approval for actual binary uploads, encrypted private object storage, malware scanning/quarantine storage, signed reads, byte-derived checksums, previews, linking, OCR, AI extraction, deletion lifecycle, credentials, and deployment.
