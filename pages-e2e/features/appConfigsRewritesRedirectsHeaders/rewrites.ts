export function rewrites() {
    return {
      beforeFiles: [
        {
          source: "/configs-rewrites/some-page",
          destination: "/configs-rewrites/query-somewhere-else",
          has: [{ type: "query", key: "overrideMe" }]
        },
        {
          source: "/configs-rewrites/some-page",
          destination: "/configs-rewrites/header-somewhere-else",
          has: [{ type: "header", key: "overrideMe" }]
        },
        {
          source: "/configs-rewrites/some-page",
          destination: "/configs-rewrites/header-somewhere-else",
          has: [{ type: "header", key: "overrideMe" }]
        },
        {
          source: "/configs-rewrites/wildcard/:slug*",
          destination: "/configs-rewrites/rewritten-wildcard/:slug*",
        },
      ],
      afterFiles: [
        {
          source: "/configs-rewrites/some-page",
          destination: "/configs-rewrites/header-somewhere-else",
        },
        {
          source: "/configs-rewrites/dynamic/:path*",
          destination: "/configs-rewrites/some-page",
        },
      ],
    //   fallback: [
    //     // These rewrites are checked after both pages/public files
    //     // and dynamic routes are checked
    //     {
    //       source: '/:path*',
    //       destination: `https://my-old-site.com/:path*`,
    //     },
    //   ],
    };
}