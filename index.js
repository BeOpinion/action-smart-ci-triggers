const core = require('@actions/core');
const github = require('@actions/github');

// @doc https://docs.github.com/en/actions/reference/events-that-trigger-workflows

const actionGithubToken = core.getInput('action-github-token');
const personalGithubToken = core.getInput('personal-github-token');
const envLabel = core.getInput('env-label');

// if the label is removed from a PR, trigger a workflow on main to let him deploy the label
// webook event = label, activity type = deleted
async function onLabelRemoved() {
  const ghApi = github.getOctokit(personalGithubToken);

  const labelRemoved = github.context.payload.label.name;

  if (labelRemoved === envLabel) {
    ghApi.repos.createDispatchEvent({
      ...github.context.repo,
      event_type: 'trigger_main_workflow',
      client_payload: {
        envLabel
      }
    });
  }

  core.setOutput('should-deploy', false);
}

// if the workflow has been triggered by a label removed, we should deploy main on the labelEnv
// webook event = repository_dispatch, activity type = trigger_main_workflow
async function onTriggerMain() {
  const labelToDeploy = github.context.payload.client_payload.envLabel;

  core.setOutput('should-deploy', envLabel === labelToDeploy);
}

// on every push on master, deploy on labelEnv if not already in a PR
// webook event = push
async function onPushMain() {
  const ghApi = github.getOctokit(actionGithubToken);

  if (github.context.ref === 'refs/heads/main' || github.context.ref === 'refs/heads/master') {
    // check that no open pull request has the envLabel
    const pulls = await ghApi.pulls.list({ ...github.context.repo, state: "open" });
    const isLabelOnPulls = pulls.data.some(pull => pull.labels.some(({ name }) => name === envLabel));
    core.setOutput('should-deploy', !isLabelOnPulls);
  } else {
    core.setOutput('should-deploy', false);
  }
}

// on pull action, remove the envLabel from other pull requests if needed
// webhook event = pull_request, activity type = opened, reopened, synchronize, labeled
async function onPull() {
  const ghApi = github.getOctokit(actionGithubToken);

  const actionPullNumber = github.context.payload.pull_request.number;

  const pulls = await ghApi.pulls.list({ ...github.context.repo });

  const actionPull = pulls.data.find(pull => pull.number === actionPullNumber);
  const hasEnvLabel = actionPull.labels.map(l => l.name).includes(envLabel);

  if (hasEnvLabel) {
    // remove the label from other pulls
    pulls.data.forEach(pull => {
      if (pull.number === actionPullNumber) {
        return;
      }
      const shouldRemoveLabel = pull.labels.map(l => l.name).includes(envLabel);
      if (shouldRemoveLabel) {
        ghApi.issues.removeLabel({
          ...github.context.repo,
          issue_number: pull.number,
          name: envLabel
        });
      }
    })
  }

  core.setOutput('should-deploy', hasEnvLabel);
}

async function run() {
  try {
    if (github.context.eventName === 'pull_request' && github.context.payload.action === 'unlabeled') {
      await onLabelRemoved();
    } else if (github.context.eventName === 'pull_request') {
      await onPull();
    } else if (github.context.eventName === 'repository_dispatch') {
      await onTriggerMain();
    } else if (github.context.eventName === 'push') {
      await onPushMain();
    } else if (github.context.eventName === 'issues') {
      await onLabelRemoved();
    }
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

run();
