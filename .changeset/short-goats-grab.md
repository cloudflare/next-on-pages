---
'@cloudflare/next-on-pages': patch
---

improve AST checking

improve the way we check for webpack chunks (for the experimental minification) by
improving the AST types used and also make the AST checking more robust