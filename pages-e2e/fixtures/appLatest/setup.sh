# Create a package.json in the workspace directory (this is needed because otherwise npm creates
# the next app at the top of the pages-e2es dir instead of doing that in the current directory)
#
# Note: this seems to be a weird node 16 behavior it doesn't seem to happen in 18, so this can be
# removed when we move to node 18
echo "{}" > package.json

# Create an app application in the application sub-directory (since the next cli complains if the target directory is not empty)
npx create-next-app@13 application appLatest --ts --no-eslint --no-tailwind --no-src-dir --app --import-alias '@/*'

# Move everything back in the current directory (so that we follow the same structure as the other fixtures
# and don't break copyWorkspaceAssets)
cp -a application/. .

# Delete the no longer needed application directory
rm -rf application
