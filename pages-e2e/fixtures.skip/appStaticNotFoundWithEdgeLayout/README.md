This application relates to: https://github.com/cloudflare/next-on-pages/issues/413

It comprises of:

- a simple home page
- a custom static not-found route
- a layout containing server-side logic

the vercel build process in such case creates an invalid (and unnecessary) \_error.func
lambda which if not ignored with would cause the build to fail
