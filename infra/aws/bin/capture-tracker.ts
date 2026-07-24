import * as cdk from "aws-cdk-lib";
import { CaptureTrackerFoundationStack } from "../lib/foundation-stack.js";
const app = new cdk.App();
const environment = app.node.tryGetContext("environment") === "production" ? "production" : "staging";
new CaptureTrackerFoundationStack(app, `CaptureTracker-${environment}`, { environment });
