'use strict';

/**
 * Module dependencies
 */

/* eslint-disable no-unused-vars */
// Public node modules.
const _ = require('lodash');
const AWS = require('aws-sdk');

function assertUrlProtocol(url) {
  // Regex to test protocol like "http://", "https://"
  return /^\w*:\/\//.test(url);
}


// provider: "aws-s3",
// providerOptions: {
//   // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property
//   accessKeyId: env("AWS_ACCESS_KEY_ID"),
//   secretAccessKey: env("AWS_SECRET_ACCESS_KEY"),
//   endpoint: env("AWS_ENDPOINT"),
//   cloudflarePublicAccessUrl: env("AWS_CUSTOM_READ_ENDPOINT"),
//   defaultAcl: false,
//   s3UseArnRegion: false,
//   s3BucketEndpoint: false, // Whether the provided endpoint addresses an individual bucket. false if it addresses the root API endpoint
//   s3ForcePathStyle: true, // removes bucket name from Endpoint URL
//   params: {
//     Bucket: env("AWS_BUCKET"),
//   },
// },

module.exports = {
  init(config) {
    const S3 = new AWS.S3({
      apiVersion: '2006-03-01',
      ...config,
    });

    const upload = (file, customParams = {}) =>
      new Promise((resolve, reject) => {
        // upload file on S3 bucket
        const path = file.path ? `${file.path}/` : '';
        S3.upload(
          {
            Key: `${path}${file.hash}${file.ext}`,
            Body: file.stream || Buffer.from(file.buffer, 'binary'),
            ContentType: file.mime,
            ...customParams,
          },
          (err, data) => {
            if (err) {
              return reject(err);
            }
            // Set the bucket file url. 
            // If there is a Custom endpoint for data access set, replace the upload endpoint with the read enpoint URL
            if(config.cloudflarePublicAccessUrl){
              file.url = config.cloudflarePublicAccessUrl.replace(/\/$/g,'')+'/'+data.Key;
            } else {
              file.url = data.Location
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
          const path = file.path ? `${file.path}/` : '';
          S3.deleteObject(
            {
              Key: `${path}${file.hash}${file.ext}`,
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
