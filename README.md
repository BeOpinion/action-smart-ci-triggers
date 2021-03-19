# Github action: smart CI triggers

Code state: POC

The idea is to let users add labels on pull requests, like "stage1" and trigger deployments on every subsequent push to this PR. 

If a user adds the same label on another PR, it removes the old one and deploys that other PR from now on.

When the user wants to deploy the main branch on stage1 instead, he justs removes the label from the PR, and a workflow is triggered on the main branch.

Here an example workflow file:
```
on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
    types: [synchronize, labeled, unlabeled]
  repository_dispatch:
    types: [trigger_main_workflow]

jobs:
  deploy_stage1_job:
    runs-on: ubuntu-latest
    name: deploy on stage1
    steps:
      - name: check deploy stage1
        uses: @BeOpinion/action-smart-ci-triggers
        id: check-deploy-stage1
        with:
          action-github-token: ${{ secrets.GITHUB_TOKEN }}
          personal-github-token: ${{ secrets.PERSONAL_GITHUB_TOKEN }}
          env-label: 'stage1'
      - name: Deploy
        if: ${{ steps.check-deploy-stage1.outputs.should-deploy == 'true' }}
        uses: rtCamp/action-slack-notify@v2.1.3
        env:
          SLACK_WEBHOOK: ${{ secrets.STAGING_SLACK_WEBHOOK }}
          SLACK_TITLE: STAGING - ${{ github.repository }}
          SLACK_FOOTER: 
          MSG_MINIMAL: ref,actions url
```
