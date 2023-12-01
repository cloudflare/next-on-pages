---
'@cloudflare/next-on-pages': patch
---

fix external middleware rewrites

Currently Middleware rewrites (`NextResponse.rewrite()`) assume that the rewrite destination
is on the same host as the application, meaning that the following operations would work as intended:
```ts
    NextResponse.rewrite(new URL('/rewrite-dest', request.url));
```
while something like this would not:
```ts
    return NextResponse.rewrite(new URL('https://my-customer-rewrite-site.come/rewrite-dest', request.url));
```

Remove such assumption and allow such external rewrites to take place (as they do on Vercel)
