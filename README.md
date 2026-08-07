# Capture Tracker

Capture Tracker is a private-pilot bookkeeping and financial-review application.

## Current production state

Production is live as `capture-tracker-production`; staging is live and fictional-only as `capture-tracker-staging`. The current private workspace was initialized through the first-owner bootstrap, and unrestricted public signup is not approved.

Use [Capture Tracker Production Operations](docs/CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md) as the authoritative current operations runbook. The concise [current production state](docs/CURRENT_PRODUCTION_STATE.md) and historical phase documents are supporting context, not replacement runbooks.

## Local development

```bash
npm run dev
```

Open `http://localhost:3000` for local fictional-data development only.

### Optional private-LAN mobile testing

To test a local dev server from a device on the same private network, add an individual private IPv4 address to the ignored local `.env` file, then bind the dev server to all local interfaces:

```dotenv
CAPTURE_TRACKER_DEV_ORIGINS=192.168.x.x
```

```bash
npm run dev -- --hostname 0.0.0.0
```

Only comma-separated private IPv4 addresses are accepted. Wildcards, public hosts, API CORS changes, and production behavior are not enabled by this setting.

## Historical cloud-staging preparation

The following links retain historical foundation and planning context. They may describe pre-production or fictional-staging states and must not be used as live production instructions.

See the [cloud runbook](docs/CLOUD_DEPLOYMENT_RUNBOOK.md), [data boundary](docs/REAL_DATA_BOUNDARY.md), [backup posture](docs/BACKUP_AND_RECOVERY.md), and [dependency review](docs/DEPENDENCY_SECURITY_REVIEW.md).
