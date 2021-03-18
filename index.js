const core = require('@actions/core');
const github = require('@actions/github');

function intersect(strings1, strings2) {
  return strings1.filter(s => strings2.includes(s))
}

async function run() {
  try {
    const githubToken = core.getInput('github-token');
    const uniqueLabels = core.getInput('unique-labels').split(',').map(label => label.trim());
    
    const ghApi = github.getOctokit(githubToken)

    const actionPullNumber = github.context.payload.pull_request.number;
    
    const pulls = await ghApi.pulls.list(github.context.repo);

    const actionPull = pulls.data.find(pull => pull.number === actionPullNumber)
    const actionPullUniqueLabels = intersect(actionPull.labels.map(l => l.name), uniqueLabels)

    pulls.data.forEach(pull => {
      if (pull.number === actionPullNumber) {
        return;
      }
      const uniqueLabelsToRemove = intersect(pull.labels.map(l => l.name), actionPullUniqueLabels)
      uniqueLabelsToRemove.forEach(labelToRemove => {
        ghApi.issues.removeLabel({
          ...github.context.repo,
          issue_number: pull.number,
          name: labelToRemove
        })
      })
    })

    core.setOutput('pr-unique-labels', actionPullUniqueLabels.join(','))
  } catch (error) {
    console.error(error)
    core.setFailed(error.message);
  }
}

run()
