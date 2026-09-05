import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function client(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });
}

export function objectKey(agreementId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `originals/${agreementId}/${safe}`;
}

export async function putFile(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET ?? "agreements",
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getFile(key: string): Promise<Buffer> {
  const res = await client().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET ?? "agreements", Key: key }),
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`object not found: ${key}`);
  return Buffer.from(bytes);
}
