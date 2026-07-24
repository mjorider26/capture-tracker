import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import assert from "node:assert/strict";
import test from "node:test";
import { CaptureTrackerFoundationStack } from "../lib/foundation-stack.js";
function template(environment: "staging" | "production") { const app = new cdk.App(); return Template.fromStack(new CaptureTrackerFoundationStack(app, `Test-${environment}`, { environment })); }
test("production data resources are private, encrypted, and retained", () => { const t = template("production"); t.hasResourceProperties("AWS::RDS::DBInstance", { PubliclyAccessible: false, StorageEncrypted: true, DeletionProtection: true, BackupRetentionPeriod: 35 }); t.hasResourceProperties("AWS::S3::Bucket", { VersioningConfiguration: { Status: "Enabled" }, PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true } }); t.resourceCountIs("AWS::KMS::Key", 2); t.hasResource("AWS::SecretsManager::Secret", {}); assert.ok(true); });
test("staging and production preserve private topology", () => { const staging = template("staging"); const production = template("production"); staging.hasResourceProperties("AWS::RDS::DBInstance", { PubliclyAccessible: false, BackupRetentionPeriod: 7 }); production.hasResourceProperties("AWS::ECS::Service", { DesiredCount: 2 }); });
