---
'@cloudflare/next-on-pages': patch
---

remove astring dependency

remove the `astring` dependency and by doing so basically just create and edit
javascript code via string manipulations.

this should speed up the experimental minification (since we don't generate js code
from ASTs anymore) and avoid potential bugs in the `astring` library (like #151)

note that this is not the cleanest solution and that we should look into implementing
more robust and stable javascript code handling via AST visiting and manipulations
(but currently that has proven quite problematic since modern javascript libraries that
allow such code modding have turned out to be very slow, significantly impacting DX)
