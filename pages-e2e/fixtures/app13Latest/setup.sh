# Create an app application in the application sub-directory (since the next cli complains if the target directory is not empty)
npx create-next-app@13 application pages13latest --ts --no-eslint --no-tailwind --no-src-dir --app --import-alias '@/*'

# Move everything back in the current directory (so that we follow the same structure as the other fixtures
# and don't break copyWorkspaceAssets)
cp -a application/. .

# Delete the no longer needed application directory
rm -rf application
