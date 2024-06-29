---
'@cloudflare/next-on-pages': patch
---

introduce in-memory mutex to avoid race condition issues in parallel worker runs

workerd isolates share the same modules registry meaning that it can happen for the same isolate to run
multiple instances of the same worker and those will share the modules' state.

this can result in race-condition issues, so introduce a mutex that allows runs not to be executed in
parallel in the same workerd isolate.
