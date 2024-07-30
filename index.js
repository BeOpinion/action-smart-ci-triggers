// Description: This action is used to determine if a service should be deployed based on labels on pull requests.
// The action will output a payload which a JSON string in the format of:
// [
//   {
//     "environment": "stage",
//     "service": "data-preview",
//   },
//   ...
// ]

const core = require("@actions/core");
const github = require("@actions/github");

const actionGithubToken = core.getInput("token");

// Return the contexts based on the label that was removed
async function onLabelRemoved() {
  core.info("Label removed event");
  const labelRemoved = github.context.payload.label.name;

  core.debug(`Label removed: ${labelRemoved}`);

  // Not a valid label. Do nothing.
  if (labelRemoved.split("-").length !== 2) {
    return;
  }

  const [environment, service] = labelRemoved.toLowerCase().split("-");

  core.setOutput(
    "contexts",
    labelRemoved.toLowerCase().split("-").length === 2
      ? [
          {
            environment,
            service,
          },
        ]
      : []
  );
}

// Return the contexts based on the labels of all open pull requests
async function onPushMain() {
  core.info("Push to main event");
  const ghApi = github.getOctokit(actionGithubToken);

  const pullRequests = await ghApi.pulls.list({
    ...github.context.repo,
    state: "open",
  });

  core.debug(`Pull requests count: ${pullRequests.data.length}`);

  const labels = [
    ...new Set(
      pullRequests.data
        .map((pullRequest) =>
          pullRequest.labels
            .map((label) => label.name)
            .filter((label) => label !== undefined)
            .filter((label) => label.toLowerCase().split("-").length === 2)
        )
        .flat()
    ),
  ];

  core.debug(`Pull request valid labels: ${labels}`);

  core.setOutput(
    "contexts",
    labels.map((label) => {
      const [environment, service] = label.toLocaleLowerCase().split("-");
      return {
        environment,
        service,
      };
    })
  );
}

// Return the contexts based on the labels of the current pull request and remove the labels from other pull requests
async function onPull() {
  core.info("Pull request event");
  const ghApi = github.getOctokit(actionGithubToken);
  const pullRequests = await ghApi.pulls.list({
    ...github.context.repo,
    state: "open",
  });
  const currentPullRequest = pullRequests.data.find(
    (pull) => pull.number === github.context.payload.pull_request.number
  );

  if (!currentPullRequest) {
    return core.setFailed("Pull request not found");
  }

  core.debug(`Current pull request labels: ${currentPullRequest.labels}`);

  // Remove labels from other pull requests
  pullRequests.data
    .filter((pullRequest) => pullRequest.number !== currentPullRequest.number)
    .forEach((pullRequest) => {
      const labelsToRemove = pullRequest.labels.filter((label) =>
        currentPullRequest.labels.some((l) => l.name === label.name)
      );
      labelsToRemove.forEach((label) =>
        ghApi.issues.removeLabel({
          ...github.context.repo,
          issue_number: pullRequest.number,
          name: label.name,
        })
      );
    });

  // Get the labels of the pull request that are in the format of environment-service and output them as contexts
  core.setOutput(
    "contexts",
    currentPullRequest.labels
      .filter(
        (label) => (label.name || "").toLowerCase().split("-").length === 2
      )
      .map((label) => {
        const [environment, service] = (label.name || "")
          .toLowerCase()
          .split("-");
        return {
          environment,
          service,
        };
      })
  );
}

async function run() {
  try {
    if (
      github.context.eventName === "pull_request" &&
      github.context.payload.action === "unlabeled"
    ) {
      await onLabelRemoved();
    } else if (github.context.eventName === "pull_request") {
      await onPull();
    } else if (
      (github.context.eventName === "push" &&
        github.context.ref === "refs/heads/main") ||
      github.context.ref === "refs/heads/master"
    ) {
      await onPushMain();
    } else if (github.context.eventName === "issues") {
      await onLabelRemoved();
    }
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

run();
