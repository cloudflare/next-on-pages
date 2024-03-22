# Create a package.json in the workspace directory (this is needed because otherwise npm creates
# the next app at the top of the pages-e2es dir instead of doing that in the current directory)
#
# Note: this seems to be a weird node 16 behavior it doesn't seem to happen in 18, so this can be
# removed when we move to node 18
echo "{}" > package.json

# Create a pages application in the application sub-directory (since the next cli complains if the target directory is not empty)
npx create-next-app@latest application pagesLatest --ts --no-eslint --no-tailwind --no-src-dir --no-app --import-alias '@/*'

# Move everything back in the current directory (so that we follow the same structure as the other fixtures
# and don't break copyWorkspaceAssets)
cp -a application/. .

# Delete the no longer needed application directory
rm -rf application

# Delete the pages/api/hello.ts as it is a default nodejs one (as we do recreate an edge version of it anyways)
rm -rf ./pages/api/hello.ts