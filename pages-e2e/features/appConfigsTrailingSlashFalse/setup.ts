import { copyWorkspaceAssets } from '../_utils/copyWorkspaceAssets';
await copyWorkspaceAssets();

// Note:
//  There's no need to update the next.config.js file here as the
//  trailingSlash property is false by default
