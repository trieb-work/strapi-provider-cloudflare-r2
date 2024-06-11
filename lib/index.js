"use strict";

/**
 * Module dependencies
 */
const _ = require("lodash");
const {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl: getS3SignedUrl } = require('@aws-sdk/s3-request-presigner');

function removeLeadingSlash(str) {
  return str.replace(/^\//, "");
}

function getPathKey(file, pool = false) {
  const filePath = file.path ? `${file.path}/` : "";
  let path = filePath;
  if (!pool) {
    path =
      file.folderPath && file.folderPath !== "/"
        ? `${removeLeadingSlash(file.folderPath)}/${filePath}`
        : filePath;
  }

  const Key = `${path}${file.hash}${file.ext}`;
  return { path, Key };
}

function assertUrlProtocol(url) {
  // Regex to test protocol like "http://", "https://"
  return /^\w*:\/\//.test(url);
}

function getFileURL(file, config) {
  if (config.cloudflarePublicAccessUrl) {
    file.url =
      config.cloudflarePublicAccessUrl.replace(/\/$/g, "") +
      "/" +
      key;
  } else if (data.Location !== "auto") {
    file.url = data.Location;
  } else if (config.params.ACL !== "private") {
    throw new Error(
      "Cloudflare S3 API returned no file location and cloudflarePublicAccessUrl is not set. strapi-provider-cloudflare-r2 requires cloudflarePublicAccessUrl to upload files larger than 5MB. https://github.com/trieb-work/strapi-provider-cloudflare-r2#provider-configuration"
    );
  }
}

module.exports = {
  init: (config) => {
    const S3 = new S3Client({
      ...config,
      region: config.region || "auto",
    });

    if (!config.cloudflarePublicAccessUrl) {
      process.emitWarning(
        "\x1b[43mWARNING (strapi-provider-cloudflare-r2):\x1b[0m the provider config requires cloudflarePublicAccessUrl to upload files larger than 5MB. See more: https://github.com/trieb-work/strapi-provider-cloudflare-r2#provider-configuration"
      );
    }

    const aws_keys = Object.keys(process.env).filter((key) =>
      key.startsWith("AWS_")
    );
    if (aws_keys.length > 0) {
      console.warn(
        `\x1b[43mWARNING (strapi-provider-cloudflare-r2):\x1b[0m You are using strapi-provider-cloudflare-r2 and still have AWS_... env vars from provider-upload-aws-s3 set. This could conflict with Cloudflare R2 provider. Please remove ${aws_keys.join(
          ", "
        )} env variable(s) or rename+change them in plugin config. See more: https://github.com/trieb-work/strapi-provider-cloudflare-r2#aws-sdk-configuration-and-aws_-env-variables`
      );
    }

    const upload = async (file, customParams = {}) => {
      const { Key } = getPathKey(file, config.pool);
      try {
        await S3.send(
          new PutObjectCommand({
            Bucket: config.params.Bucket,
            ACL: config.params.ACL,
            Key,
            Body: file.stream || Buffer.from(file.buffer, "binary"),
            ContentType: file.mime,
            ...customParams,
          })
        );

        file.url = getFileURL(file, config);

        // check if https is included in file URL
        if (!assertUrlProtocol(file.url)) {
          // Default protocol to https protocol
          file.url = `https://${file.url}`;
        }
      } catch (error) {
        console.log("An error occurred while uploading the file", error);
      }
    };

    const _delete = async (file, customParams = {}) => {
      const { Key } = getPathKey(file, config.pool);
      try {
        await S3.send(
          new DeleteObjectCommand({
            Bucket: config.params.Bucket,
            Key,
            ...customParams,
          })
        );
      } catch (error) {
        console.log("An error occurred while deleting the file", error);
      }
    }


    const getSignedUrl = async (file) => {
      const { Key } = getPathKey(file, config.pool);
      try {
        const url = await getS3SignedUrl(S3, new GetObjectCommand({ Bucket: config?.params?.Bucket, Key }), { expiresIn: 3600 });
        return { url };
      } catch (error) {
        console.log("An error occurred while generating the signed URL", error);
      }
    };

    const isPrivate = async () => {
      return config.params.ACL === "private";
    }

    return {
      uploadStream: upload,
      upload,
      delete: _delete,
      getSignedUrl,
      isPrivate,
    }
  }
};
