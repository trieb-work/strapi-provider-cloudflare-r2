"use strict";

/**
 * Module dependencies
 */

/* eslint-disable no-unused-vars */
// Public node modules.
const _ = require("lodash");
const AWS = require("aws-sdk");

function assertUrlProtocol(url) {
  // Regex to test protocol like "http://", "https://"
  return /^\w*:\/\//.test(url);
}

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

module.exports = {
  init(config) {
    const S3 = new AWS.S3({
      apiVersion: "2006-03-01",
      ...config,
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

    const upload = (file, customParams = {}) =>
      new Promise((resolve, reject) => {
        // upload file on S3 bucket
        const { Key } = getPathKey(file, config.pool);
        S3.upload(
          {
            Key,
            Body: file.stream || Buffer.from(file.buffer, "binary"),
            ContentType: file.mime,
            ...customParams,
          },
          (err, data) => {
            if (err) {
              return reject(err);
            }

            // When a file is >5MB, Location is set to "auto" and the bucket name is prepended to the key.

            // Strip bucket name from key if Location is auto
            const key =
              data.Location === "auto" &&
              data.Key.startsWith(`${config.params.Bucket}/`)
                ? data.Key.replace(`${config.params.Bucket}/`, "")
                : data.Key;

            // Set the bucket file URL.
            // If there is a custom endpoint for data access set, replace the upload endpoint with the read enpoint URL.
            // Otherwise, use location returned from S3 API if it's not "auto"
            if (config.cloudflarePublicAccessUrl) {
              file.url =
                config.cloudflarePublicAccessUrl.replace(/\/$/g, "") +
                "/" +
                key;
            } else if (data.Location !== "auto") {
              file.url = data.Location;
            } else {
              throw new Error(
                "Cloudflare S3 API returned no file location and cloudflarePublicAccessUrl is not set. strapi-provider-cloudflare-r2 requires cloudflarePublicAccessUrl to upload files larger than 5MB. https://github.com/trieb-work/strapi-provider-cloudflare-r2#provider-configuration"
              );
            }

            // check if https is included in file URL
            if (!assertUrlProtocol(file.url)) {
              // Default protocol to https protocol
              file.url = `https://${file.url}`;
            }

            resolve();
          }
        );
      });

    return {
      uploadStream(file, customParams = {}) {
        return upload(file, customParams);
      },
      upload(file, customParams = {}) {
        return upload(file, customParams);
      },
      delete(file, customParams = {}) {
        return new Promise((resolve, reject) => {
          // delete file on S3 bucket
          const { Key } = getPathKey(file, config.upload);
          S3.deleteObject(
            {
              Key,
              ...customParams,
            },
            (err, data) => {
              if (err) {
                return reject(err);
              }

              resolve();
            }
          );
        });
      },
    };
  },
};
