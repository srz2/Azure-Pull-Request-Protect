Custom Release Branch Logic
===========================

This is toggled in settings: useCustomReleaseBranchLogic

**Defaults to disabled.**

This logic is based on; The current date and the previous iteration

There are two assumptions:
1. A target release branch where "release/" is a path, and the date in year, month, day are period deliminated in the format of `release/2026.03.04`
2. A current iteration(sprint) where the sprint name is followed by the start and end dates in the format of `2026.03 (02.18 to 03.10)`

From this we can determine the following information:
- The release branch is for the release date of March 4th, 2026
- The sprint run time is between February 18th, 2026 to March 10th, 2026.

By given rules documented here:
- Given a sprint, the PREVIOUS release date for code is two weeks from the CURRENT sprint's start date
- The code seal date for the PREVIOUS release branch is 1 day before the start of the CURRENT sprint's start date
