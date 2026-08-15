import { createHash, createHmac } from "node:crypto";

const backupBucket = "capture-tracker-production-backups";

type R2Credentials = {
  accessKeyId: string;
  endpoint: URL;
  region: string;
  secretAccessKey: string;
};

export class ScopedR2OperationError extends Error {
  readonly httpStatus: number;
  readonly providerCode?: string;

  constructor(httpStatus: number, providerCode?: string) {
    super("R2_OBJECT_OPERATION_FAILED");
    this.httpStatus = httpStatus;
    this.providerCode = providerCode;
  }
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("R2_CREDENTIAL_REQUIRED");
  return value;
}

function credentials(): R2Credentials {
  const accountId = required("CLOUDFLARE_ACCOUNT_ID");
  const endpoint = new URL(required("AWS_ENDPOINT_URL"));
  if (
    process.env.CAPTURE_TRACKER_BACKUP_BUCKET !== backupBucket
    || endpoint.protocol !== "https:"
    || !endpoint.hostname.startsWith(`${accountId}.`)
    || !endpoint.hostname.endsWith(".r2.cloudflarestorage.com")
  ) throw new Error("R2_SCOPE_REFUSED");
  return {
    accessKeyId: required("AWS_ACCESS_KEY_ID"),
    endpoint,
    region: required("AWS_REGION"),
    secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
  };
}

function hmac(key: string | Buffer<ArrayBufferLike>, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function sha256(value: Buffer<ArrayBufferLike> | string) {
  return createHash("sha256").update(value).digest("hex");
}

function pathFor(objectKey: string) {
  if (!objectKey || objectKey.startsWith("/") || objectKey.includes("..")) throw new Error("R2_OBJECT_KEY_REFUSED");
  return `/${[backupBucket, ...objectKey.split("/")].map(encodeURIComponent).join("/")}`;
}

async function request(method: "GET" | "PUT", objectKey: string, body: Buffer<ArrayBufferLike> = Buffer.alloc(0)) {
  const credential = credentials();
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = now.slice(0, 8);
  const uri = pathFor(objectKey);
  const payloadHash = sha256(body);
  const canonicalHeaders = `host:${credential.endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${now}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const scope = `${date}/${credential.region}/s3/aws4_request`;
  const canonicalRequest = `${method}\n${uri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${now}\n${scope}\n${sha256(canonicalRequest)}`;
  const dateKey = hmac(`AWS4${credential.secretAccessKey}`, date);
  const signingKey = hmac(hmac(hmac(dateKey, credential.region), "s3"), "aws4_request");
  const signature = hmac(signingKey, stringToSign).toString("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${credential.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(`${credential.endpoint.origin}${uri}`, {
    method,
    headers: {
      host: credential.endpoint.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": now,
      authorization,
    },
    body: body.length ? body as unknown as BodyInit : undefined,
  });
  if (response.status !== 200) {
    const responseBody = await response.text();
    const providerCode = responseBody.match(/<Code>([A-Za-z][A-Za-z0-9]{0,63})<\/Code>/)?.[1];
    throw new ScopedR2OperationError(response.status, providerCode);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function putBackupObject(objectKey: string, body: Buffer) {
  await request("PUT", objectKey, body);
}

export async function getBackupObject(objectKey: string) {
  return request("GET", objectKey);
}
