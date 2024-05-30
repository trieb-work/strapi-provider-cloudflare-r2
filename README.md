[![npm version](https://badge.fury.io/js/strapi-provider-cloudflare-r2.svg)](https://badge.fury.io/js/strapi-provider-cloudflare-r2)

# strapi-provider-cloudflare-r2

## Installation

```bash
# using yarn
yarn add strapi-provider-cloudflare-r2

# using npm
npm install strapi-provider-cloudflare-r2 --save

# using pnpm 
pnpm add strapi-provider-cloudflare-r2
```



## Configuration

- `provider` defines the name of the provider
- `providerOptions` is passed down during the construction of the provider. (ex: `new AWS.S3(config)`). [Complete list of options](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property)
- `actionOptions` is passed directly to the parameters to each method respectively. You can find the complete list of [upload/ uploadStream options](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property) and [delete options](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#deleteObject-property)

See the [documentation about using a provider](https://docs.strapi.io/developer-docs/latest/plugins/upload.html#using-a-provider) for information on installing and using a provider. To understand how environment variables are used in Strapi, please refer to the [documentation about environment variables](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/configurations/optional/environment.html#environment-variables).

### Provider Configuration

`./config/plugins.js` or `./config/plugins.ts` for TypeScript projects:

```js
module.exports = ({ env }) => ({
  // ...
  upload: {
    config: {
      provider: "strapi-provider-cloudflare-r2",
      providerOptions: {
        credentials: {
          accessKeyId: env("CF_ACCESS_KEY_ID"),
          secretAccessKey: env("CF_ACCESS_SECRET"),
        },
        region: env("CF_REGION"),
        /**
         * `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
         */
        endpoint: env("CF_ENDPOINT"),
        params: {
          ACL: 'private',
          Bucket: env("CF_BUCKET"),
          accountId: env("CF_ACCOUNT_ID"),
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
  // ...
});
```

**Where to find the configuration options**  
You can find all needed values in the Cloudflare dashboard unter `R2`. All your buckets, your account ID and the access keys can be found there.

- endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- accessKeyId: You need to click on `Manage R2 API Tokens` to create a new token.
- secretAccessKey: You need to click on `Manage R2 API Tokens` to create a new token.

### Security Middleware Configuration

This is an important step for private buckets as by default Strapi adds the `updatedAt` field to the file object. This field is not allowed in the Cloudflare R2 API and will result in a `400 Bad Request` error. To avoid this error we need to remove the `updatedAt` field from the file object before it is returned to the client.

`./config/middlewares/strapi-provider-cloudflare-r2/index.js` or `.ts` for TypeScript projects:

```js
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    await next();

    if (ctx.request.url.includes("upload/files")) {
      if (ctx.response.body && typeof ctx.response.body === "object") {
        for (let file of ctx.response.body.results) {
          if (file.url.includes(".r2.cloudflarestorage.com")) delete file.updatedAt
        }
      }
    }
  };
};
```

Due to the default settings in the Strapi Security Middleware you will need to modify the `contentSecurityPolicy` settings to properly display thumbnail previews in the Media Library. You should replace the `strapi::security` string with the object below **instead as explained in the [middleware configuration](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/configurations/required/middlewares.html#loading-order) documentation**.

`./config/middlewares.js`

```js
module.exports = ({ env }) => [
  // ...
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            `${env('CF_BUCKET')}.${env('CF_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
          ],
          "media-src": [
            "'self'",
            "data:",
            "blob:",
            `${env('CF_BUCKET')}.${env('CF_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  // ...
];
```

### `aws-sdk` configuration and `AWS_...` env variables

As the Clouflare R2 spec follows the AWS S3 spec we make use of `aws-sdk` package to communicate with Cloudflare R2. Because of this dependency all `AWS_...` env variables used to configure the `aws-sdk` are still beeing pulled in by this dependency. If you do not want to configure any special functionality of the `aws-sdk` then make sure to remove all `AWS_...` env variables in you deployment.

## Bucket CORS Configuration

Do not forget to configure your R2 Endpoint CORS settings as described here: https://developers.cloudflare.com/r2/buckets/cors/

The simplest configuration is to allow GET from all origins:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET"]
  }
]
```

More safe would be to only allow it from your Strapi deployment Origins (**better for production**):

```json
[
  {
    "AllowedOrigins": ["YOUR STRAPI URL"],
    "AllowedMethods": ["GET"]
  }
]
```

## Sponsors

[Strapi Plugin developed and maintained by trieb.work cloud consulting](https://trieb.work/)
