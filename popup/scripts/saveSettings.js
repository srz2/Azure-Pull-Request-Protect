var verboseLoggingCheckbox = document.getElementById("verboseLogging");
var disableCompleteCheckbox = document.getElementById("disableCompleteOnPolicyViolation");

verboseLoggingCheckbox.addEventListener("change", (event) => {
    saveSettings({verboseLogging: event.target.checked});
});

disableCompleteCheckbox.addEventListener("change", (event) => {
    saveSettings({disableCompleteOnPolicyViolation: event.target.checked});
});

// Load settings from storage
let settings = chrome.storage.sync.get("settings", (data) => {
    settings = data.settings || DEFAULTS;
});

// Listen for changes in storage and update settings accordingly
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
        settings = changes.settings.newValue || DEFAULTS;
    }
});

// Function to save settings to storage
function saveSettings(newSettings) {
    settings = {...settings, ...newSettings};
    chrome.storage.sync.set({settings});
}

// Load settings when the popup is opened
window.onload = function() {
    settings = chrome.storage.sync.get("settings", (data) => {
        console.log("Settings loaded from storage:", data);
        settings = data.settings || DEFAULTS;
        console.log("Settings loaded:", settings);
        // Update the UI based on loaded settings
        verboseLoggingCheckbox.checked = settings.verboseLogging;
        disableCompleteCheckbox.checked = settings.disableCompleteOnPolicyViolation;
    });
}