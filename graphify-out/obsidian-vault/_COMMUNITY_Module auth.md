---
type: community
cohesion: 0.40
members: 5
---

# Module: auth

**Cohesion:** 0.40 - moderately connected
**Members:** 5 nodes

## Members
- [[auth.js]] - code - admin/public/portal/js/auth.js
- [[authenticate()]] - code - admin/server/middleware/auth.js
- [[authorize()]] - code - admin/server/middleware/auth.js
- [[generateToken()]] - code - admin/server/middleware/auth.js
- [[requirePortalAuth()]] - code - admin/public/portal/js/auth.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Module:_auth
SORT file.name ASC
```
