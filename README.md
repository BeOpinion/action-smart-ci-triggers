# Github action: smart CI triggers

## Overview

This action return contexts (see [Concepts](#Concepts)) according to labels on opened pull requests.

The behavior of the action depends on the event that triggered the workflow:

- **pull_request**:
  - **unlabeled**: See [Unlabeled workflow](#unlabeled-workflow)
  - else: See [Pull request workflow](#pull-request-workflow)
- **push**:
  - **branch=main** or **branch=master**: See [Push to main or master branch workflow](#push-to-main-or-master-branch-workflow)

## Concepts

**Explanation**:

**Context**: A context is a JSON formated string that contains the following keys:

- `environment`: The environment designated by the label
- `service`: The service designated by the label
- `region`: The region used for staging environments

This action return an array of contexts under the `contexts` output.

**Example**:

From the following labels:

- `staging-api`
- `staging-web`

The output will be:

```json
[
  {
    "environment": "staging",
    "service": "api",
    "region": "eu-west-1"
  },
  {
    "environment": "staging",
    "service": "web",
    "region": "eu-west-1"
  }
]
```

## Workflows

### Overview

According to the event that triggered the workflow, the action will return contexts as follows.

### Pull request workflow

**Steps**:

1. Get the labels in the pull request which triggered the workflow
2. Check if the labels are present in any other opened pull request
3. If some of the labels are present in any other opened pull request, remove the labels from other pull requests
4. Return the contexts associated with the labels

**Example**:

```
on:
  pull_request:
    branches:
      - main
    types:
      - opened
      - synchronize
      - labeled

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - name: Get contexts
        uses: @BeOpinion/action-smart-ci-triggers@v3.2.0
        id: get-contexts
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy
        run: |
          echo "Contexts to deploy=${{ steps.get-contexts.outputs.contexts }}"
```

### Unlabeled workflow

**Steps**:

1. Get the label removed from the pull request which triggered the workflow
2. Check if the label is present in any other opened pull request
3. If the label is not present in any other opened pull request, return the context associated with the label
4. If the label is present in another opened pull request, return an empty array

**Example**:

```
on:
  pull_request:
    types:
      - unlabeled

jobs:
  rollback:
    runs-on: ubuntu-latest
    name: Rollback
    steps:
      - name: Get contexts
        uses: @BeOpinion/action-smart-ci-triggers@v3.2.0
        id: get-contexts
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Rollback
        run: |
          echo "Contexts to rollback=${{ steps.get-contexts.outputs.contexts }}"
```

### Push to main or master branch workflow

**Steps**:

1. Get the labels in all opened pull requests
2. Return the contexts associated with the labels

**Example**:

```
on:
  push:
    branches:
      - main
      - master

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - name: Get contexts
        uses: @BeOpinion/action-smart-ci-triggers@v3.2.0
        id: get-contexts
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy
        run: |
          echo "Contexts to do not deploy=${{ steps.get-contexts.outputs.contexts }}"
```
