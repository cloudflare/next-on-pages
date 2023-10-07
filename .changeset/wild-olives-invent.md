---
'@cloudflare/next-on-pages': patch
---

fix wasms not always getting imported when necessary

Details:
when dealing with wasms that have more than 1 consumer, when we collect
the wasm imports to prepend for a specific edge funcion we're always
re-setting the array of wasm imports instead of appending them, this 
causes edge functions to always only consider the last wasm
import, the changes here fix such behavior
