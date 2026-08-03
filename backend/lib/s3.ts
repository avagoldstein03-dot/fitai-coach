import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";

const s3 = new AWS.S3({
  region: process.env.AWS_S3_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const BUCKET = process.env.AWS_S3_BUCKET!;

export async function uploadBase64ToS3(
  base64: string,
  folder: string,
  prefix: string
): Promise<string> {
  const imageBuffer = Buffer.from(
    base64.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );

  const ext = base64.startsWith("data:image/png") ? "png" : "jpg";
  const key = `${folder}/${prefix}-${uuidv4()}.${ext}`;

  await s3
    .putObject({
      Bucket: BUCKET,
      Key: key,
      Body: imageBuffer,
      ContentType: `image/${ext}`,
    })
    .promise();

  return `https://${BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;
}

export async function uploadBufferToS3(
  buffer: Buffer,
  folder: string,
  prefix: string,
  ext: string,
  contentType: string
): Promise<string> {
  const key = `${folder}/${prefix}-${uuidv4()}.${ext}`;

  await s3
    .putObject({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
    .promise();

  return `https://${BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;
}

export async function deleteS3Object(url: string): Promise<void> {
  try {
    const urlObj = new URL(url);
    const key = urlObj.pathname.replace(/^\//, "");
    await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
  } catch {
    // Non-fatal — log but don't throw
    console.error("S3 delete failed for:", url);
  }
}
