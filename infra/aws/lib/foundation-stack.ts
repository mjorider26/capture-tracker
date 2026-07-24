import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export type FoundationProps = cdk.StackProps & { environment: "staging" | "production" };
export class CaptureTrackerFoundationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FoundationProps) {
    super(scope, id, props);
    const production = props.environment === "production";
    const retain = cdk.RemovalPolicy.RETAIN;
    const vpc = new ec2.Vpc(this, "Vpc", { maxAzs: 2, natGateways: production ? 2 : 1, subnetConfiguration: [
      { name: "public", subnetType: ec2.SubnetType.PUBLIC },
      { name: "application", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      { name: "database", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    ]});
    const documentKey = new kms.Key(this, "DocumentKey", { enableKeyRotation: true, removalPolicy: retain, pendingWindow: cdk.Duration.days(30), description: `${props.environment} private document encryption` });
    const databaseKey = new kms.Key(this, "DatabaseKey", { enableKeyRotation: true, removalPolicy: retain, pendingWindow: cdk.Duration.days(30), description: `${props.environment} database encryption` });
    const bucket = new s3.Bucket(this, "DocumentBucket", { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, encryption: s3.BucketEncryption.KMS, encryptionKey: documentKey, versioned: true, removalPolicy: retain, autoDeleteObjects: false, objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED, lifecycleRules: [{ noncurrentVersionExpiration: cdk.Duration.days(365), abortIncompleteMultipartUploadAfter: cdk.Duration.days(7) }] });
    bucket.addToResourcePolicy(new iam.PolicyStatement({ effect: iam.Effect.DENY, principals: [new iam.AnyPrincipal()], actions: ["s3:PutObject"], resources: [bucket.arnForObjects("*")], conditions: { "Null": { "s3:x-amz-server-side-encryption": "true" } } }));
    const appSg = new ec2.SecurityGroup(this, "ApplicationSecurityGroup", { vpc, allowAllOutbound: true, description: "Capture Tracker application tasks" });
    const databaseSg = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", { vpc, allowAllOutbound: false, description: "Private Capture Tracker PostgreSQL" });
    databaseSg.addIngressRule(appSg, ec2.Port.tcp(5432), "Application PostgreSQL only");
    const db = new rds.DatabaseInstance(this, "Database", { engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_17 }), vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, securityGroups: [databaseSg], credentials: rds.Credentials.fromGeneratedSecret("capture_tracker"), storageEncrypted: true, storageEncryptionKey: databaseKey, publiclyAccessible: false, multiAz: production, backupRetention: cdk.Duration.days(production ? 35 : 7), deleteAutomatedBackups: false, removalPolicy: retain, deletionProtection: production, allocatedStorage: 30, maxAllocatedStorage: production ? 200 : 80, instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO) });
    const authSecret = new secretsmanager.Secret(this, "ApplicationSecret", { description: `${props.environment} Better Auth secret`, generateSecretString: { excludePunctuation: true } });
    const logGroup = new logs.LogGroup(this, "ApplicationLogs", { retention: production ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK, removalPolicy: retain });
    const cluster = new ecs.Cluster(this, "Cluster", { vpc });
    const task = new ecs.FargateTaskDefinition(this, "Task", { cpu: production ? 512 : 256, memoryLimitMiB: production ? 1024 : 512 });
    task.addContainer("Application", { image: ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/node:22"), logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "capture-tracker" }), user: "10001", readonlyRootFilesystem: true, environment: { CAPTURE_TRACKER_ENVIRONMENT: props.environment, CAPTURE_TRACKER_EXECUTION_CONTEXT: "aws", CAPTURE_TRACKER_REAL_DATA_APPROVED: "false" }, secrets: { BETTER_AUTH_SECRET: ecs.Secret.fromSecretsManager(authSecret), DATABASE_URL: ecs.Secret.fromSecretsManager(db.secret!) }, healthCheck: { command: ["CMD-SHELL", "node -e \"process.exit(0)\""], interval: cdk.Duration.seconds(30) }, portMappings: [{ containerPort: 3000 }] });
    bucket.grantReadWrite(task.taskRole); db.secret!.grantRead(task.taskRole); authSecret.grantRead(task.taskRole);
    const lb = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", { vpc, internetFacing: true });
    const listener = lb.addListener("Http", { port: 80, open: true });
    const service = new ecs.FargateService(this, "Service", { cluster, taskDefinition: task, desiredCount: production ? 2 : 1, securityGroups: [appSg], assignPublicIp: false, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }, minHealthyPercent: 100, maxHealthyPercent: 200 });
    listener.addTargets("Application", { port: 3000, protocol: elbv2.ApplicationProtocol.HTTP, targets: [service], healthCheck: { path: "/api/health/ready", healthyHttpCodes: "200" } });
    new cdk.CfnOutput(this, "DocumentBucketName", { value: bucket.bucketName });
  }
}
