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

function isValidLabel(label) {
  return label.split("-").length >= 2;
}

function getLabelContext(label) {
  const [environment, ...services] = label.split("-");
  const service = services.join("-");
  return { environment, service };
}

// Return the contexts based on the label that was removed
async function onLabelRemoved() {
  const labelRemoved = (
    github.context.payload.label.name || ""
  ).toLocaleLowerCase();
  core.debug(`Label removed: ${labelRemoved}`);

  // Not a valid label. Do nothing.
  if (!isValidLabel(labelRemoved)) {
    core.setOutput("contexts", []);
    return;
  }

  const ghApi = github.getOctokit(actionGithubToken);
  const pullRequests = await ghApi.pulls.list({
    ...github.context.repo,
    state: "open",
  });
  const otherPullRequests = pullRequests.data.filter(
    (pullRequest) =>
      pullRequest.number !== github.context.payload.pull_request.number
  );
  const otherPRLabels = otherPullRequests
    .flatMap((pullRequest) =>
      pullRequest.labels.map((label) => (label.name || "").toLocaleLowerCase())
    )
    .filter(isValidLabel);

  // Already on another pull request. Do nothing.
  if (otherPRLabels.includes(labelRemoved)) {
    core.setOutput("contexts", []);
    return;
  }

  core.setOutput("contexts", [getLabelContext(labelRemoved)]);
}

// Return the contexts based on the labels of all open pull requests
async function onPushMain() {
  const ghApi = github.getOctokit(actionGithubToken);
  const pullRequests = await ghApi.pulls.list({
    ...github.context.repo,
    state: "open",
  });

  core.debug(`Pull requests count: ${pullRequests.data.length}`);

  const labels = [
    ...new Set(
      pullRequests.data
        .flatMap((pullRequest) =>
          pullRequest.labels.map((label) => (label.name || "").toLowerCase())
        )
        .filter(isValidLabel)
    ),
  ];

  core.debug(`Pull request valid labels: ${labels}`);
  core.setOutput("contexts", labels.map(getLabelContext));
}

// Return the contexts based on the labels of the current pull request and remove the labels from other pull requests
async function onPull() {
  const ghApi = github.getOctokit(actionGithubToken);
  const pullRequests = await ghApi.pulls.list({
    ...github.context.repo,
    state: "open",
  });
  const currentPullRequest = pullRequests.data.find(
    (pullRequest) =>
      pullRequest.number === github.context.payload.pull_request.number
  );
  const otherPullRequests = pullRequests.data.filter(
    (pullRequest) =>
      pullRequest.number !== github.context.payload.pull_request.number
  );

  if (!currentPullRequest) {
    core.warning("Pull request not found");
  }

  const labels = currentPullRequest
    ? currentPullRequest.labels
        .map((label) => (label.name || "").toLocaleLowerCase())
        .filter(isValidLabel)
    : [];

  core.debug(`Current pull request labels: ${labels}`);

  otherPullRequests.forEach((pullRequest) => {
    const labelsToRemove = pullRequest.labels.filter((label) => {
      const formattedLabel = (label.name || "").toLocaleLowerCase();

      return labels.includes(formattedLabel) && isValidLabel(formattedLabel);
    });

    labelsToRemove.forEach((label) =>
      ghApi.issues.removeLabel({
        ...github.context.repo,
        issue_number: pullRequest.number,
        name: label.name,
      })
    );
  });

  // Get the labels of the pull request that are in the format of environment-service and output them as contexts
  core.setOutput("contexts", labels.map(getLabelContext));
}

async function dispatch() {
  try {
    switch (github.context.eventName) {
      case "pull_request":
        core.info("Pull request event");

        if (github.context.payload.action === "unlabeled") {
          core.info("Unlabeled workflow started");
          await onLabelRemoved();
        } else {
          core.info("Pull request workflow started");
          await onPull();
        }
        break;
      case "push":
        core.info("Push event");

        if (
          github.context.ref === "refs/heads/main" ||
          github.context.ref === "refs/heads/master"
        ) {
          core.info("Push to main workflow started");
          await onPushMain();
        }
        break;
      default:
        core.setFailed("Unsupported event");
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

dispatch();
