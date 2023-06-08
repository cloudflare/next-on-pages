# `next-on-pages/missing-image-loader`

Since applications built using `@cloudflare/next-on-pages` don't run on the Vercel network, the build-in Vercel loader is not available (also the adapter does not yet support configuring the image loader in the `next.config.js` file), so If you use the [`Image`](https://nextjs.org/docs/pages/api-reference/components/image) component, in order for it to provide the correct images you need to pass to the component a custom loader (as indicated in the [Cloudflare Image Integration docs](https://developers.cloudflare.com/images/image-resizing/integration-with-frameworks/#nextjs)), this rules helps ensure that you do that.

## ❌ Invalid Code


```jsx
  import Image from 'next/image';

  export default function Page() {
    ...
    return <>
      ...
      <Image
        src="/my-img.png"
        alt="My Image"
      />
      ...
    </>;
  }
```

```jsx
  import * as NextImg from 'next/image';

  export default function Page() {
    ...
    return <>
      ...
      <NextImg
        src="/my-img.png"
        alt="My Image"
      />
      ...
    </>;
  }
```

## ✅ Valid Code

```jsx
  import Image from 'next/image';

  export default function Page() {
    ...
    return <>
      ...
      <Image
        loader={myLoader}
        src="/my-img.png"
        alt="My Image"
      />
      ...
    </>;
  }
```

```jsx
  import * as NextImg from 'next/image';

  export default function Page() {
    ...
    return <>
      ...
      <NextImg
        loader={myLoader}
        src="/my-img.png"
        alt="My Image"
      />
      ...
    </>;
  }
```