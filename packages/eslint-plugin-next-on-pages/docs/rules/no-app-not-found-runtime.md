# `next-on-pages/no-app-not-found-runtime`

[Not found](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) app router components are not currently supported with `@cloudflare/next-on-pages`, the only current alternative is not to export a runtime and making sure that the component doesn't have runtime logic. In such a way a static 404 page gets generated during the build time and served to users.

> **Note**
> This restriction applies only to top-level not-found pages (present in the `app` directory), not-found pages
> nested inside routes are handled correctly and can contain runtime logic.

## ❌ Invalid Code

```js
// app/not-found.jsx

export const runtime = 'edge';
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

> **Warning**
> The following code is invalid but not caught by the rule, please be aware of such limitation

```js
// app/not-found.jsx

import { cookies } from 'next/headers';

export default function NotFound() {
    // notice the runtime cookie retrieval
    const cookieStore = cookies();
    const theme = cookieStore.get('theme');

    return (
      <div className={`not-found--${theme}`}>
        <h2>Not Found</h2>
      </div>
    );
}
```

## ✅ Valid Code

```js
// app/not-found.jsx

export default function NotFound() {
    return (
      <div>
        <h2>Not Found</h2>
      </div>
    );
}
```
