async function getPullRequestById(prId) {
  if (!settings.azureDevopsSettings.organization || !settings.azureDevopsSettings.project || !settings.azureDevopsSettings.team) {
    console.error("Azure DevOps settings are not configured. Please configure them in the settings page.");
    return null;
  }

  var response = await fetch(`https://dev.azure.com/${settings.azureDevopsSettings.organization}/${settings.azureDevopsSettings.project}/_apis/git/pullrequests/${prId}?api-version=7.0`);
  if (response.ok) {
      var data = await response.json();
      return data;
  } else {
      console.error("Failed to fetch pull request details:", response.status, response.statusText);
      return null;
  }
}

async function getCurrentIteration() {
  if (!settings.azureDevopsSettings.organization || !settings.azureDevopsSettings.project || !settings.azureDevopsSettings.team) {
    console.error("Azure DevOps settings are not configured. Please configure them in the settings page.");
    return null;
  }
  
  try {
    const response = await fetch(`https://dev.azure.com/${settings.azureDevopsSettings.organization}/${settings.azureDevopsSettings.project}/${settings.azureDevopsSettings.team}/_apis/work/teamsettings/iterations?api-version=7.0`);
    if (response.ok) {
      var data = await response.json();
      data = data.value.filter(iteration => iteration.attributes?.timeFrame === "current")[0];
      return data;
    } else {
      console.error("Failed to fetch iterations:", response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error("Error fetching iterations:", error);
    return null;
  }
}
