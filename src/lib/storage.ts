import { Client } from "minio";

// MinIO/S3 object storage for uploaded assets (company logos). Objects are
// world-readable: the bucket is served publicly at S3_PUBLIC_URL through the
// Cloudflare tunnel, so a stored URL keeps working with zero third-party hosts.

const BUCKET = process.env.S3_BUCKET ?? "logos";

let client: Client | null = null;
let bucketReady = false;

function getClient(): Client {
  if (!client) {
    const endpoint = new URL(process.env.S3_ENDPOINT ?? "http://127.0.0.1:9100");
    client = new Client({
      endPoint: endpoint.hostname,
      port: endpoint.port ? parseInt(endpoint.port, 10) : endpoint.protocol === "https:" ? 443 : 80,
      useSSL: endpoint.protocol === "https:",
      accessKey: process.env.S3_ACCESS_KEY ?? "",
      secretKey: process.env.S3_SECRET_KEY ?? "",
    });
  }
  return client;
}

function publicBase(): string {
  return (process.env.S3_PUBLIC_URL ?? "http://127.0.0.1:9100").replace(/\/+$/, "");
}

async function ensureBucket(c: Client): Promise<void> {
  if (bucketReady) return;
  if (!(await c.bucketExists(BUCKET))) await c.makeBucket(BUCKET);
  // Anonymous read-only on the whole bucket — it holds nothing but public assets.
  await c.setBucketPolicy(
    BUCKET,
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKET}/*`],
        },
      ],
    }),
  );
  bucketReady = true;
}

/** Store a world-readable object and return its public URL. */
export async function putPublicObject(key: string, body: Buffer, contentType: string): Promise<string> {
  const c = getClient();
  await ensureBucket(c);
  await c.putObject(BUCKET, key, body, body.length, {
    "Content-Type": contentType,
    // Keys are content-unique (random uuid), so far-future caching is safe.
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  return `${publicBase()}/${BUCKET}/${key}`;
}

/** Best-effort delete of an object we host, identified by its public URL. */
export async function deletePublicObject(url: string | null): Promise<void> {
  const prefix = `${publicBase()}/${BUCKET}/`;
  if (!url?.startsWith(prefix)) return;
  try {
    await getClient().removeObject(BUCKET, url.slice(prefix.length));
  } catch (err) {
    console.error("storage delete failed:", err);
  }
}
