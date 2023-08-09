# Caching and Data Revalidation

`@cloudflare/next-on-pages` comes with support for data revalidation and caching for fetch requests. This is done in our router and acts as an extension to Next.js' built-in functionality.

## Storage Options

There are various different bindings and storage options that `@cloudflare/next-on-pages` supports for caching.

We recommend evaluating each option and choosing the one that best suits your use case, depending on latency and consistency requirements.

### Workers KV

[Workers KV](https://developers.cloudflare.com/workers/learning/how-kv-works/) is globally-distributed, low-latency storage option that is ideal for caching data. While it's designed for this use case, KV is an eventually-consistent data store, meaning that it can take up to 60 seconds for changes to propagate globally. This is fine for many use cases, but if you need to ensure that data is updated more frequently globally, you should consider a different storage option.

1. Create a [new KV Namespace](https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces).
2. Find your [Pages project](https://dash.cloudflare.com/?to=/:account/workers-and-pages) in the Cloudflare dashboard.
3. Go to your Pages project Settings > Functions > KV Namespace Bindings.
4. Add a new binding mapping `KV_SUSPENSE_CACHE` to your created KV Namespace.

### Cloudflare D1

[Cloudflare D1](https://developers.cloudflare.com/d1/) is a read-replicated, serverless database offering that uses SQLite. Unlike KV, it is strongly-consistent, meaning that changes will be accessible instantly, globally. However, while being read-replicated, it is not distributed in every data center, so there could be a minor impact on latency.

1. Create a [new D1 Database](https://dash.cloudflare.com/?to=/:account/workers/d1) if you don't already have one.
2. Create a new table in your database by clicking "Create table".
   2.1. Give your table the name `suspense_cache`.
   2.2. Add a row with the name `key` and type `text`, and set it as the primary key.
   2.3. Add a row with the name `value` and type `text`.
3. Find your [Pages project](https://dash.cloudflare.com/?to=/:account/workers-and-pages) in the Cloudflare dashboard.
4. Go to your Pages project Settings > Functions > D1 Database Bindings.
5. Add a new binding mapping `D1_SUSPENSE_CACHE` to your D1 Database.

If you would like to create the table with SQL instead, you can use the following query:

```sql
CREATE TABLE IF NOT EXISTS suspense_cache (key text PRIMARY KEY, value text NOT NULL);
```

### Cloudflare R2

[Cloudflare R2](https://developers.cloudflare.com/r2/) is an S3-compatible object storage offering that is globally distributed and strongly consistent. It is ideal for storing large amounts of unstructured data, but is likely to experience higher latency that KV or D1.

1. Create a [new R2 Bucket](https://dash.cloudflare.com/?to=/:account/r2/overview).
2. Find your [Pages project](https://dash.cloudflare.com/?to=/:account/workers-and-pages) in the Cloudflare dashboard.
3. Go to your Pages project Settings > Functions > R2 Bucket Bindings.
4. Add a new binding mapping `R2_SUSPENSE_CACHE` to your created R2 Bucket.

### Cache API

The [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) is a per data-center cache that is ideal for storing data that is not required to be accessible globally. Due to this limitation, it is not a recommended storage option for Next.js caching and data revalidation - we suggest using one of the other options above.

No additional setup is required to use the Cache API.
