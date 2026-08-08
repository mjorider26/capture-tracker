# V1.1 backlog

This is planning only. Capture Tracker V1.0.0 is feature frozen; none of these items is authorization to change production.

## High value

| Item | Problem / user value | Risk | Effort | Excluded from V1.0.0 because |
| --- | --- | --- | --- | --- |
| Scanner cold-start reduction | Fresh scanner readiness is much slower than the warm path; improves receipt wait experience. | Cost, availability, and fail-closed security tradeoffs. | M | The 15-minute warm window was the accepted V1 mitigation. |
| Supported additional-client onboarding | V1 has only the closed first-owner bootstrap; allows legitimate multi-tenant growth. | High tenant/auth/accounting setup risk. | L | Requires dedicated product, security, and operational approval. |
| Document workflow polish | Improve scan-state explanations and document organization without weakening controls. | Could confuse security state or links. | M | V1 acceptance prioritized correct quarantine lifecycle. |
| Operational alerting | Earlier notice for scanner, Queue, DLQ, and cleanup failures. | Alert fatigue and privacy design. | M | First-week manual monitoring is sufficient for V1 pilot. |

## Medium value

| Item | Problem / user value | Risk | Effort | Excluded from V1.0.0 because |
| --- | --- | --- | --- | --- |
| PWA/installability review | Better shortcut/install experience. | Offline expectations and auth cache behavior. | M | Browser shortcut is documented and accepted. |
| Documents and Activity pagination | Better usability for larger histories. | Completeness and cursor correctness. | M | Pilot volumes are manageable. |
| Accessibility automation | More repeatable accessibility regression detection. | Tooling false positives and remediation scope. | M | Core acceptance focused on functional safety. |
| Design-system cleanup | More consistent visual details. | Broad UI regression surface. | M | No visual refactor during release lock. |

## Later

| Item | Problem / user value | Risk | Effort | Excluded from V1.0.0 because |
| --- | --- | --- | --- | --- |
| Advanced AI capabilities | More helpful workflows beyond read-only assistance. | Data privacy, provider approval, hallucination, and mutation risk. | L | Production AI provider is intentionally not approved. |
| Integrations | Reduce manual entry with external systems. | Credential, data-boundary, and accounting correctness risk. | L | V1 is intentionally self-contained. |
| Expanded multi-user roles | Broader collaboration model. | Authorization and audit complexity. | L | V1 has a constrained membership model. |
| Advanced analytics | More operational insight. | Privacy and data-retention risk. | L | No invasive analytics in the initial pilot. |
