# Capture Tracker

Capture Tracker is a fictional-data-only bookkeeping and financial-review application. Production is undeployed and no real customer onboarding is permitted.

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

## Fictional cloud staging preparation

Repository-only Cloudflare/Neon staging preparation is complete. External provider setup, migration, bootstrap, deployment, reachable testing, backup/restore drill, and cost verification are deliberately deferred.

See the [cloud runbook](docs/CLOUD_DEPLOYMENT_RUNBOOK.md), [data boundary](docs/REAL_DATA_BOUNDARY.md), [backup posture](docs/BACKUP_AND_RECOVERY.md), and [dependency review](docs/DEPENDENCY_SECURITY_REVIEW.md).
