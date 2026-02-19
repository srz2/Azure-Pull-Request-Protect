console.log("Content script loaded.");

const DEFAULTS = {
  verboseLogging: false,
  branchPolicies: [
    {
      source: "feature/*",
      target: "main",
      reason: "Feature branches should not be merged directly into main."
    },
    {
      source: "story/*",
      target: "develop",
      reason: "Story branches should be merged into a feature branch."
    },
    {
      source: "testing/test-feature-branch",
      target: "testing/test-main-branch",
      reason: "This is a testing policy to see if I can filter correctly on source and target branches."
    },
    {
      source: "*",
      target: "release/*",
      reason: "You should not merge directly into release branches."
    }
  ]
};

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

function filterPullRequestOnPolicies(source, target){
    if (settings.verboseLogging) {
        console.log("Filtering pull request on policy with the following settings:", settings);
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

    if (completeSpan.innerHTML.toLowerCase() == "complete") {
        if (settings.disableCompleteOnPolicyViolation) {
            completeSpan.innerHTML = "Complete (Disabled)";
            completeButton.setAttribute("disabled", "true");
        } else {
            completeSpan.innerHTML = "⚠️ Complete ⚠️";
        }
    }

    divider.style.setProperty("background-color", "var(--palette-error-10)");
    dropdown.style.setProperty("background-color", "var(--palette-error-10)");

    const header = getPullRequestHeader();
    const warningElement = createWarningElement("⚠️ This pull request violates branch policies", violatedPolicies);
    
    currentWarningElement = warningElement
    header.appendChild(warningElement);
}

async function init(){
    if (initialized) return;
    initialized = true;

    var loadingSettings = await loadSettings();
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