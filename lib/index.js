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

function getPathKey(file) {
  const filePath = file.path ? `${file.path}/` : "";
  const path =
    file.folderPath && file.folderPath !== "/"
      ? `${removeLeadingSlash(file.folderPath)}/${filePath}`
      : filePath;

  const Key = `${path}${file.hash}${file.ext}`;
  return { path, Key };
}

module.exports = {
  init: (config) => {
    const S3 = new S3Client({
      ...config,
      region: "auto",
    });

    const upload = async (file, customParams = {}) => {
      const { Key } = getPathKey(file);
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
      } catch (error) {
        console.log("An error occurred while uploading the file", error);
      }
    };

    const _delete = async (file, customParams = {}) => {
      const { Key } = getPathKey(file);
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
      const { Key } = getPathKey(file);
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