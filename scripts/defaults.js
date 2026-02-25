/**
 * Single source of truth for extension default settings.
 * Used by content script and popup/settings.
 */
const DEFAULTS = {
  verboseLogging: false,
  disableCompleteOnPolicyViolation: true,
  useCustomReleaseBranchLogic: false,
  azureDevopsSettings: {
    organization: null,
    project: null,
    team: null
  },
  branchPolicies: [
    {
      source: "feature/*",
      target: "main",
      reason: "Feature branches should not be merged directly into main."
    },
    {
      source: "story/*",
      target: "main",
      reason: "Story branches should be merged into a feature branch."
    }
  ]
};
