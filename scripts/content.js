let initialized = false;
let settings = DEFAULTS;
let completeButton = null;
let currentWarningElement = null;
let lastPathName = location.pathname;
let lastSource = null;
let lastTarget = null;

async function loadSettings() {
    const result = await chrome.storage.sync.get("settings");

    settings = result.settings ?? DEFAULTS;

    if (settings.verboseLogging) {
        console.log("Settings loaded:", settings);
    }

    if (completeButton){
        if (settings.disableCompleteOnPolicyViolation) {
            completeButton.setAttribute("disabled", "true");
        } else {
            completeButton.removeAttribute("disabled");
        }
    }
}

function isPullRequestPage() {
    return window.location.href.includes("/pullrequest/");
}

function getPullRequestHeader(){
    return document.querySelector('.repos-pr-header .flex-column');
}

function getPullRequestBranches(){
    const branches = document.querySelectorAll('.pr-header-branches .bolt-link');
    const source = branches[0];
    const target = branches[1];
    
    return {
        source: source.textContent.trim(),
        target: target.textContent.trim()
    }
}

async function releaseIsSealed(releaseBranch) {
    var iteration = await getCurrentIteration();
    if (!iteration) {
        console.warn("Unable to determine current iteration. Assuming not sealed.");
        return false;
    }

    // Now represents a potential date of merging code to release
    var now = Date.now();

    // Highly dependent on the iteration naming convention.
    // This is based on the current convention used by the team, but may need to be updated if that convention changes.
    // Example: 2026.03 (02.18 to 03.10)
    var tempStart = iteration.name.substr(iteration.name.indexOf('(') + 1, 5);
    var tempEnd = iteration.name.substr(iteration.name.indexOf('to') + 3, 5);
    var year = new Date(Date.now()).getFullYear();
    var monthStart = parseInt(tempStart.substr(0, 2));
    var dayStart = parseInt(tempStart.substr(3, 2));
    var monthEnd = parseInt(tempEnd.substr(0, 2));
    var dayEnd = parseInt(tempEnd.substr(3, 2));
    const iterationStartDate = new Date(year, monthStart - 1, dayStart);    // This doesn't actually matter
    const iterationEndDate = new Date(year, monthEnd - 1, dayEnd);          // This doesn't actually matter
    const prevIterationProdCodeSealDate = new Date(year, monthStart - 1, dayStart - 1); // Assuming code seal for current production release is 2 days before current iteration start date, but we use 1 day since code seal is Close Of Business
    const prevIterationProdReleaseDate = new Date(year, monthStart - 1, dayStart + 14); // Assuming production release is 2 weeks after iteration start date
    const currentIterationProdCodeSealDate = new Date(year, monthEnd - 1, dayEnd - 1); // Assuming code seal for production release is 1 day before iteration end date

    const releaseDate = releaseBranch.split("/")[1];
    const [, month, day] = releaseDate.split(".").map(Number);
    const releaseBranchDate = new Date(year, month - 1, day);   // This should match the release date of prevIterationProdReleaseDate

    // A branch will be in violation of code seal if:
    // 1. It belongs to the previous production release
    // 2. We are past the code seal date for that release
    if ((releaseBranchDate.getTime() === prevIterationProdReleaseDate.getTime() && now >= prevIterationProdCodeSealDate.getTime())) {
        return true;
    }

    return false;
}

function checkIfCodeSealViolated(targetBranch) {
    // If the target branch is not a release branch, we assume it's not subject to code sealing.
    if (!targetBranch.toLowerCase().startsWith("release/")) {
        return false;
    }

    // Check if target is passed code seal.
    return releaseIsSealed(targetBranch);
}

function filterPullRequestOnPolicies(source, target){
    if (settings.verboseLogging) {
        console.log("Filtering pull request on policy with the following settings:", settings);
    }

    if (settings.useCustomReleaseBranchLogic) {
        var pullRequestViolatesCodeSeal = checkIfCodeSealViolated(target);
        if (pullRequestViolatesCodeSeal) {
            if (settings.verboseLogging) {
                console.log(`Pull request violates code seal policy for release branches. Target branch: ${target}`);
            }
            return [{
                reason: "This pull request violates the code seal policy for release branches."
            }];
        } else {
            if (settings.verboseLogging) {
                console.log(`Pull request does not violate code seal policy for release branches. Target branch: ${target}`);
            }
        }
    }

    var matchedRules = settings.branchPolicies.filter(rule => {
        const sourceMatch = new RegExp(rule.source.replace("*", ".*")).test(source);
        const targetMatch = new RegExp(rule.target.replace("*", ".*")).test(target);

        if (settings.verboseLogging) {
            console.log(`Checking rule: source pattern "${rule.source}" against "${source}" => ${sourceMatch}`);
            console.log(`Checking rule: target pattern "${rule.target}" against "${target}" => ${targetMatch}`);
        }
        return sourceMatch && targetMatch;
    });

    return matchedRules;
}

function getCompleteButton(){
    return document.querySelector('.repos-pr-header-complete-button button');
}

function showWarningModal(message) {
  if (document.getElementById("pr-guard-modal")) return;

  const modal = document.createElement("div");
  modal.id = "pr-guard-modal";
  modal.innerHTML = `
    <div class="overlay">
      <div class="modal">
        <h2>⚠️ Merge Warning</h2>
        <p>${message}</p>
        <button id="cancel">Cancel</button>
        <button id="continue">Continue Anyway</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancel").onclick = () => modal.remove();
  document.getElementById("continue").onclick = () => {
    modal.remove();
    //forceMerge();
  };
}

function createWarningElement(innerText, violatedPolicies) {
    const warningElement = document.createElement("span");
    warningElement.textContent = innerText + ":";

    if (violatedPolicies && violatedPolicies.length > 1) {
        const policyList = document.createElement("ul");
        policyList.style.marginTop = "5px";
        policyList.style.marginBottom = "0px";
        policyList.style.paddingLeft = "20px";

        violatedPolicies.forEach(policy => {
            const listItem = document.createElement("li");
            listItem.textContent = policy.reason;
            listItem.style.listStyleType = "decimal";
            listItem.style.marginLeft = "20px";
            policyList.appendChild(listItem);
        });

        warningElement.appendChild(policyList);
    } else {
        warningElement.textContent += " " + (violatedPolicies.length > 0 ? violatedPolicies[0].reason : "Unknown policy violation.");
    }

    Object.assign(warningElement.style, {
        paddingLeft: "15px",
        marginTop: "10px",
        color: "var(--text-secondary-color)",
        backgroundColor: "var(--callout-background-color)",
        padding: "10px",
    });

    return warningElement
}

function errorizePullRequest(completeButton, violatedPolicies){
    if (settings.verboseLogging) {
        console.log("Azure Pull Request Protect Extension: Pull request violates policies.");
    }

    const completeSpan = completeButton.querySelector('.bolt-button-text');
    const divider = completeButton.parentElement.querySelector('.bolt-split-button-divider');
    const dropdown = completeButton.parentElement.querySelector('.bolt-split-button-option');

    completeButton.classList.remove("primary");
    completeButton.style.setProperty("background-color", "var(--palette-error-10)");

    // If the button text is "Complete", change it to indicate that it's disabled due to policy violation.
    // If the setting doesn't disable the button, change the text to indicate the warning.
    if (completeSpan.innerHTML.toLowerCase() === "complete") {
        if (settings.disableCompleteOnPolicyViolation) {
            completeSpan.innerHTML = "Complete (Disabled)";
        } else {
            completeSpan.innerHTML = "⚠️ Complete ⚠️";
        }
    }

    // Disable the complete button if the setting is enabled
    completeButton.setAttribute("disabled", settings.disableCompleteOnPolicyViolation ? "true" : "false");

    divider.style.setProperty("background-color", "var(--palette-error-10)");
    dropdown.style.setProperty("background-color", "var(--palette-error-10)");

    const header = getPullRequestHeader();
    const warningElement = createWarningElement("⚠️ This pull request violates branch policies", violatedPolicies);
    
    currentWarningElement = warningElement
    header.appendChild(warningElement);
}

function getPullRequestIdFromUrl() {
    const url = window.location.pathname;
    const match = url.match(/\/pullrequest\/(\d+)/i);
    return match ? match[1] : null;
}

async function init(){
    if (initialized) return;
    initialized = true;

    await loadSettings();

    // Get the object for easy processing of PR details.
    var prId = getPullRequestIdFromUrl();
    var prObject = await getPullRequestById(prId);
    if (!prObject) {
        console.error("Unable to fetch pull request details. Initialization aborted.");
        return;
    }
    var isDraft = prObject.isDraft;
    var isActive = prObject.status === "active";
    if (!isActive || isDraft) {
        if (settings.verboseLogging) {
            console.log("Pull request is either not active or is a draft. Protections not needed.");
        }
        return;
    }

    if (settings.verboseLogging) {
        console.log("Current settings:", settings);
    }

    // Clear previous warning if it exists
    if (currentWarningElement) {
        currentWarningElement.remove();
        currentWarningElement = null;
    }

    if (settings.verboseLogging) {
        console.log("Initializing Azure Pull Request Protect Extension...");
    }

    // Get the complete button; if we can't we are unable to continue
    const button = getCompleteButton();
    completeButton = button;
    if (!button) {
        console.error("Not on a pull request page or complete button not found.");
        return;
    }

    // Get the source and target branches of the pull request
    // filter the pull request on the branch policies
    // if any of the policies are violated, show a warning and disable the complete button
    const {source, target} = getPullRequestBranches();
    lastSource = source;
    lastTarget = target;
    var violatedPolicies = filterPullRequestOnPolicies(source, target);
    if (settings.verboseLogging) {
       console.log(`Source: ${source}, Target: ${target}, Violated Policies:`, violatedPolicies);
    }

    if (violatedPolicies.length > 0) {
        // showWarningModal("This pull request is not properly configured");
        errorizePullRequest(button, violatedPolicies);
    }
}

function shouldReinitialize() {
    // Location Changed
    if (location.pathname != lastPathName) {
        lastPathName = location.pathname;
        if (settings.verboseLogging) {
            console.log(`Pathname changed: ${lastPathName}`);
        }
        return true;
    }

    // Branches changed but we are still on the same page, we should reinitialize to check if the new branches violate any policies
    const {source, target} = getPullRequestBranches();
    if (lastSource !== source || lastTarget !== target) {
        if (settings.verboseLogging) {
            console.log(`Branches changed: Source (${lastSource} -> ${source}), Target (${lastTarget} -> ${target})`);
        }
        return true;
    }

    // No relevant changes detected, no need to reinitialize
    return false;
}

const observer = new MutationObserver(() => {
    if (settings && settings.verboseLogging) {
        console.log("DOM mutation observed, checking for page changes...", initialized);
    }
    
    if (shouldReinitialize()) {
        if (settings && settings.verboseLogging) {
            console.log("Page change detected, reinitializing...");
        }
        initialized = false;
    }

    if (isPullRequestPage()) {
        init();
    }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

chrome.storage.onChanged.addListener(loadSettings);