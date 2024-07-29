# Github action: smart CI triggers

## Overview

This action checks return contexts (see [Concepts](#Concepts)) according to labels on opened pull requests.

The behavior of the action depends on the event that triggered the workflow:

- **push (main or master branch)**: The action return the contexts associated with the labels of all opened pull requests.
- **pull_request (opened, synchronize, labeled)**: The action return the contexts associated with the labels of the pull request.
- **pull_request (unlabeled)**: The action return the contexts associated with the label that was removed from the pull request.

## Concepts

- **Context**: A context is a JSON formated string that contains the following keys:

  - `environment`: The environment designated by the label
  - `service`: The service designated by the label

This action return an array of contexts under the `contexts` output. Output example:

```json
[
  {
    "environment": "staging",
    "service": "api"
  },
  {
    "environment": "staging",
    "service": "web"
  }
]
```

## Example

Here an example workflow file:

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
        uses: @BeOpinion/action-smart-ci-triggers@v3.0.0
        id: get-contexts
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      - name: Deploy
        uses: rtCamp/action-slack-notify@v2.1.3
        strategy:
          matrix:
            context: ${{ fromJSON(steps.get-contexts.outputs.contexts) }}
        env:
          SLACK_WEBHOOK: ${{ secrets.STAGING_SLACK_WEBHOOK }}
          SLACK_TITLE: ${{ matrix.context.environment }} - ${{ matrix.context.service }}
          SLACK_FOOTER: ""
          MSG_MINIMAL: ref,actions url
```
