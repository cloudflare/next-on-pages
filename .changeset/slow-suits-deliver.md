---
'@cloudflare/next-on-pages': minor
---

utilize Wrangler new capability of dynamically importing code to avoid the evaluation/run of javascript code
when not necessary, reducing the app's startup time (which causes apps to often hit the script startup CPU time limit)
