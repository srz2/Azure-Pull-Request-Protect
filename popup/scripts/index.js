var verboseLoggingCheckbox = document.getElementById("verboseLogging");
var disableCompleteCheckbox = document.getElementById("disableCompleteOnPolicyViolation");
var customReleaseBranchLogicCheckbox = document.getElementById("customReleaseBranchLogic");
var azureDevOpsOrganizationInput = document.getElementById("azureDevOpsOrganization");
var azureDevOpsProjectInput = document.getElementById("azureDevOpsProject");
var azureDevOpsTeamInput = document.getElementById("azureDevOpsTeam");
var policiesList = document.getElementById("policies-list");
var newPolicyBtn = document.getElementById("new-policy-btn");
var newPolicyForm = document.getElementById("new-policy-form");
var newPolicySource = document.getElementById("new-policy-source");
var newPolicyTarget = document.getElementById("new-policy-target");
var newPolicyDescription = document.getElementById("new-policy-description");
var newPolicyCancelBtn = document.getElementById("new-policy-cancel");
var newPolicySaveBtn = document.getElementById("new-policy-save");
var deleteModal = document.getElementById("delete-modal");
var deleteModalCancel = document.getElementById("delete-modal-cancel");
var deleteModalConfirm = document.getElementById("delete-modal-confirm");
var modalPolicyInfoText = document.getElementById("modal-policy-info-text");
var testConnectionButton = document.getElementById("test-connection-button");
var devOpsStatusLabel = document.getElementById("dev-ops-status-label");

let settings = DEFAULTS;
let pendingDeleteIndex = null;

function showNewPolicyForm() {
    if (newPolicyForm) newPolicyForm.classList.remove("hidden");
}
async function testAdoDevOpsConnection() {
    devOpsStatusLabel.textContent = "Testing connection...";
    devOpsStatusLabel.classList.remove("ado-status-hide", "ado-status-show-error");
    await getCurrentIteration().then(iteration => {
        if (iteration) {
            devOpsStatusLabel.textContent = "Connection successful!";
            setTimeout(() => {
                devOpsStatusLabel.classList.add("ado-status-hide");
            }, 1000);
        } else {
            devOpsStatusLabel.textContent = "Connection failed.\nPlease check your settings and try again.";
            devOpsStatusLabel.classList.add("ado-status-show-error");
        }
    }).catch(error => {
        console.error("Error testing Azure DevOps connection:", error);
        devOpsStatusLabel.textContent = "Connection failed. Please check your settings and try again.";
    });
}
function hideNewPolicyForm() {
    if (newPolicyForm) newPolicyForm.classList.add("hidden");
    if (newPolicySource) newPolicySource.value = "";
    if (newPolicyTarget) newPolicyTarget.value = "";
    if (newPolicyDescription) newPolicyDescription.value = "";
}

function addNewPolicy() {
    var source = (newPolicySource && newPolicySource.value.trim()) || "";
    var target = (newPolicyTarget && newPolicyTarget.value.trim()) || "";
    var reason = (newPolicyDescription && newPolicyDescription.value.trim()) || "No description.";
    if (!source || !target) return;
    var policies = Array.isArray(settings.branchPolicies) ? settings.branchPolicies.slice() : [];
    policies.push({ source: source, target: target, reason: reason });
    saveSettings({ branchPolicies: policies });
    hideNewPolicyForm();
}

function showDeleteModal(index) {
    var policies = Array.isArray(settings.branchPolicies) ? settings.branchPolicies.slice() : [];
    if (index < 0 || index >= policies.length) return;
    
    var policy = policies[index];
    var policyInfo = policy.source + " -> " + policy.target;
    
    pendingDeleteIndex = index;
    if (modalPolicyInfoText) {
        modalPolicyInfoText.textContent = policyInfo;
    }
    if (deleteModal) {
        deleteModal.classList.remove("hidden");
    }
}

function hideDeleteModal() {
    pendingDeleteIndex = null;
    if (deleteModal) {
        deleteModal.classList.add("hidden");
    }
}

function confirmDeletePolicy() {
    if (pendingDeleteIndex === null) return;
    
    var policies = Array.isArray(settings.branchPolicies) ? settings.branchPolicies.slice() : [];
    if (pendingDeleteIndex < 0 || pendingDeleteIndex >= policies.length) {
        hideDeleteModal();
        return;
    }
    
    policies.splice(pendingDeleteIndex, 1);
    saveSettings({ branchPolicies: policies });
    hideDeleteModal();
}

function enterEditMode(index) {
    var policyCard = document.querySelector(`.policy-card[data-policy-index="${index}"]`);
    if (!policyCard) return;
    
    var policy = settings.branchPolicies[index];
    if (!policy) return;
    
    var policyContent = policyCard.querySelector('.policy-content');
    var policyReason = policyCard.querySelector('.policy-reason');
    var editBtn = policyCard.querySelector('.policy-edit-btn');
    var deleteBtn = policyCard.querySelector('.policy-delete-btn');
    
    if (!policyContent || !policyReason || !editBtn) return;
    
    // Convert to edit mode
    policyCard.classList.add('editing');
    policyContent.innerHTML = `
        <div class="policy-branch">
            <span class="branch-label">Source:</span>
            <input type="text" class="policy-edit-source" value="${escapeHtml(policy.source)}" />
        </div>
        <div class="policy-arrow">→</div>
        <div class="policy-branch">
            <span class="branch-label">Target:</span>
            <input type="text" class="policy-edit-target" value="${escapeHtml(policy.target)}" />
        </div>
    `;
    policyReason.innerHTML = `
        <textarea class="policy-edit-reason" rows="2">${escapeHtml(policy.reason)}</textarea>
    `;
    
    // Change edit button to save button
    editBtn.textContent = 'Save';
    editBtn.classList.remove('policy-edit-btn');
    editBtn.classList.add('policy-save-btn');
    editBtn.onclick = function() { savePolicyEdit(index); };
    
    // Disable delete button while editing
    if (deleteBtn) deleteBtn.disabled = true;
}

function savePolicyEdit(index) {
    var policyCard = document.querySelector(`.policy-card[data-policy-index="${index}"]`);
    if (!policyCard) return;
    
    var sourceInput = policyCard.querySelector('.policy-edit-source');
    var targetInput = policyCard.querySelector('.policy-edit-target');
    var reasonInput = policyCard.querySelector('.policy-edit-reason');
    
    if (!sourceInput || !targetInput || !reasonInput) return;
    
    var source = sourceInput.value.trim();
    var target = targetInput.value.trim();
    var reason = reasonInput.value.trim() || "No description.";
    
    if (!source || !target) {
        alert('Source and target are required.');
        return;
    }
    
    var policies = Array.isArray(settings.branchPolicies) ? settings.branchPolicies.slice() : [];
    if (index < 0 || index >= policies.length) return;
    
    policies[index] = { source: source, target: target, reason: reason };
    saveSettings({ branchPolicies: policies });
}

// Function to render branch policies
function renderPolicies() {
    if (!policiesList) return;
    
    policiesList.innerHTML = '';
    
    if (!settings.branchPolicies || settings.branchPolicies.length === 0) {
        policiesList.innerHTML = '<p class="no-policies">No branch policies configured.</p>';
        return;
    }
    
    settings.branchPolicies.forEach((policy, index) => {
        const policyCard = document.createElement('div');
        policyCard.className = 'policy-card';
        policyCard.setAttribute('data-policy-index', index);
        policyCard.innerHTML = `
            <div class="policy-header">
                <span class="policy-number">Policy ${index + 1}</span>
                <div class="policy-actions">
                    <button type="button" class="policy-edit-btn" title="Edit policy" data-policy-index="${index}">Edit</button>
                    <button type="button" class="policy-delete-btn" title="Delete policy" data-policy-index="${index}">X</button>
                </div>
            </div>
            <div class="policy-content">
                <div class="policy-branch">
                    <span class="branch-label">Source:</span>
                    <span class="branch-value">${escapeHtml(policy.source)}</span>
                </div>
                <div class="policy-arrow">to</div>
                <div class="policy-branch">
                    <span class="branch-label">Target:</span>
                    <span class="branch-value">${escapeHtml(policy.target)}</span>
                </div>
            </div>
            <div class="policy-reason">
                <span class="reason-text">${escapeHtml(policy.reason)}</span>
            </div>
        `;
        var editBtn = policyCard.querySelector('.policy-edit-btn');
        var deleteBtn = policyCard.querySelector('.policy-delete-btn');
        if (editBtn) {
            editBtn.addEventListener('click', function () { enterEditMode(index); });
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function () { showDeleteModal(index); });
        }
        policiesList.appendChild(policyCard);
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

verboseLoggingCheckbox.addEventListener("change", (event) => {
    saveSettings({verboseLogging: event.target.checked});
});

disableCompleteCheckbox.addEventListener("change", (event) => {
    saveSettings({disableCompleteOnPolicyViolation: event.target.checked});
});

customReleaseBranchLogicCheckbox.addEventListener("change", (event) => {
    saveSettings({useCustomReleaseBranchLogic: event.target.checked});
});

azureDevOpsOrganizationInput.addEventListener("change", (event) => {
    saveSettings({azureDevopsSettings: {...settings.azureDevopsSettings, organization: event.target.value}});
});

azureDevOpsProjectInput.addEventListener("change", (event) => {
    saveSettings({azureDevopsSettings: {...settings.azureDevopsSettings, project: event.target.value}});
});

azureDevOpsTeamInput.addEventListener("change", (event) => {
    saveSettings({azureDevopsSettings: {...settings.azureDevopsSettings, team: event.target.value}});
});

if (testConnectionButton) testConnectionButton.addEventListener("click", testAdoDevOpsConnection);
if (newPolicyBtn) newPolicyBtn.addEventListener("click", showNewPolicyForm);
if (newPolicyCancelBtn) newPolicyCancelBtn.addEventListener("click", hideNewPolicyForm);
if (newPolicySaveBtn) newPolicySaveBtn.addEventListener("click", addNewPolicy);
if (deleteModalCancel) deleteModalCancel.addEventListener("click", hideDeleteModal);
if (deleteModalConfirm) deleteModalConfirm.addEventListener("click", confirmDeletePolicy);
if (deleteModal) {
    deleteModal.addEventListener("click", function(e) {
        if (e.target === deleteModal) {
            hideDeleteModal();
        }
    });
}

// Listen for changes in storage and update settings accordingly
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
        settings = changes.settings.newValue || DEFAULTS;
        updateUI();
    }
});

// Function to save settings to storage
function saveSettings(newSettings) {
    settings = {...settings, ...newSettings};
    chrome.storage.sync.set({settings});
    updateUI();
}

// Function to update UI based on current settings
function updateUI() {
    if (verboseLoggingCheckbox) {
        verboseLoggingCheckbox.checked = settings.verboseLogging;
    }
    if (disableCompleteCheckbox) {
        disableCompleteCheckbox.checked = settings.disableCompleteOnPolicyViolation;
    }
    if (customReleaseBranchLogicCheckbox) {
        customReleaseBranchLogicCheckbox.checked = settings.useCustomReleaseBranchLogic;
    }
    if (azureDevOpsOrganizationInput) {
        azureDevOpsOrganizationInput.value = settings.azureDevopsSettings.organization;
    }
    if (azureDevOpsProjectInput) {
        azureDevOpsProjectInput.value = settings.azureDevopsSettings.project;
    }
    if (azureDevOpsTeamInput) {
        azureDevOpsTeamInput.value = settings.azureDevopsSettings.team;
    }
    renderPolicies();
}

// Load settings when the popup is opened
window.onload = function() {
    chrome.storage.sync.get("settings", (data) => {
        console.log("Settings loaded from storage:", data);
        settings = data.settings || DEFAULTS;
        console.log("Settings loaded:", settings);
        updateUI();
    });
}