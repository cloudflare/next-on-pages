# Supported Versions and Features

## Supported Next.js versions

Based on manual testing it seems like the latest Next.js version (`13.2.4` at the time of writing) is supported.

Earlier and Later versions might be only partially supported, we don't fully know.

> The team is very soon going to test various different versions and make improvements to the documentation on which Next.js versions are supported and to what degree.

## Build Output Configuration

> The following options have been gathered from the [Vercel Build Output API (v3) documentation](https://vercel.com/docs/build-output-api/v3#build-output-configuration):

| `config.json` property  | Support |
| ----------------------- | ------- |
| version                 | `3`     |
| routes `src`            | ✅      |
| routes `dest`           | 🔄      |
| routes `headers`        | 🔄      |
| routes `methods`        | ✅      |
| routes `continue`       | 🔄      |
| routes `caseSensitive`  | ✅      |
| routes `check`          | 🔄      |
| routes `status`         | 🔄      |
| routes `has`            | ✅      |
| routes `missing`        | ✅      |
| routes `locale`         | 🔄      |
| routes `middlewarePath` | ✅      |
| images<sup>1</sup>      | 🔄      |
| wildcard                | 🔄      |
| overrides               | 🔄      |
| cache                   | ❌      |

    - ✅: Supported
    - 🔄: Not currently supported, but it's probably possible and we may add support in the future
    - ❌: Not supported and unlikely we ever will support this

- _1_ - **images**: If you want to use `next/image`, you can provide your own [custom loader](https://nextjs.org/docs/api-reference/next/image#loader) and use Cloudflare Image Resizing, as per [Cloudflare's Image Resizing documentation](https://developers.cloudflare.com/images/image-resizing/integration-with-frameworks/#nextjs).

## next.config.js Properties

> The following options have been gathered from the [Next.js next.config.js documentation](https://nextjs.org/docs/api-reference/next.config.js/introduction).

| Option                                     | Support |
| ------------------------------------------ | ------- |
| environment variables                      | 🔄      |
| base path                                  | ✅      |
| rewrites                                   | 🔄      |
| redirects                                  | 🔄      |
| custom headers                             | 🔄      |
| custom page extensions                     | ✅      |
| CDN support with asset prefix              | 🔄      |
| custom Image loader config                 | 🔄      |
| custom webpack config                      | ✅      |
| compression<sup>1</sup>                    | ❌      |
| runtime configuration<sup>2</sup>          | ❌      |
| disabling x-powered-by                     | 🔄      |
| disabling ETag generation                  | 🔄      |
| disabling HTTP keep-alive                  | ❌      |
| setting custom build directory<sup>3</sup> | ❌      |
| configuring the build id                   | ✅      |
| configuring onDemandEntries<sup>4</sup>    | ❌      |
| ignoring ESLint                            | ✅      |
| ignoring TypeScript errors                 | ✅      |
| exportPathMap<sup>5</sup>                  | ❌      |
| trailing slash                             | 🔄      |
| react Strict Mode<sup>6</sup>              | 🔄      |
| URL imports                                | ✅      |
| build indicator<sup>7</sup>                | ❌      |
| Turbopack-specific options<sup>8</sup>     | ❌      |

    - ✅: Supported
    - 🔄: Not currently supported, but it's probably possible and we may add support in the future
    - ❌: Not supported and unlikely we ever will support this

- _1_ - **compression**: [Cloudflare applies gzip or brotli compression](https://developers.cloudflare.com/support/speed/optimization-file-size/what-will-cloudflare-compress) automatically. When developing locally with Wrangler, no compression is applied.

- _2_ - **runtime configuration**: We could look into implementing the runtime configuration but it is probably not worth it since it is a legacy configuration and environment variables should be used instead.

- _3_ - **setting custom build directory**: Applications built using `@cloudflare/next-on-pages` don't rely on the `.next` directory so this option isn't really applicable.

- _4_ - **configuring onDemandEntries**: Not applicable since it's an option for the Next.js server during development which we don't rely on.

- _5_ - **exportPathMap**: Option used for SSG not applicable for apps built using `@cloudflare/next-on-pages`.

- _6_ - **React strict mode**: Currently we build the application so React strict mode doesn't work either way. If we can make strict mode work, this option will most likely work straight away.

- _7_ - **build indicator**: If you're developing using `wrangler pages dev`, we do hard refreshes so the indicator doesn't appear. If you run your app locally using `next dev`, this option works fine.

- _8_ - **Turbopack-specific options**: Turbopack is not currently supported on `@cloudflare/next-on-pages` (this might change in the future so we might reconsider the addition of this option).
