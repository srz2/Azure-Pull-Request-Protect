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
