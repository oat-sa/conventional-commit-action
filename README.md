# conventional-commit-action

Github action to check conventional commits on OAT pull requests.

The action will : 
 - Fail pull request with no conventional commits
 - Post a comment with the target version number based on pull request commits

## Inputs

### `github_token`

**Required** A token with permissions to read/write in the PR.

## Outputs

### `version`

The version number expected from the commits.

## Usage

This action expects to run on a git repo, that contains the last tags. 
To ensure it, you should run the `actions/checkout` (or similar) action first : 

```yaml
name: Continous integration

on:
  pull_request:
    branches: [ develop ]

jobs:
  pr-check:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - run: git fetch --unshallow --tags
    - name: Check commit
      if: always()
      uses: oat-sa/conventional-commit-action@v0
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Development

**Please commit the content of the `/dist` folder after the build**

Set up :
```sh
npm ci
```

Build :
```sh
npm run build
```
