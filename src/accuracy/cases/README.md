# Reference test cases

Each `.json` file here is a comparison exported from the app's **Check accuracy**
page: the shot inputs plus the answers another app (Hornady, Applied Ballistics)
gave at 100–1000 yd.

`reference.test.ts` runs every file on every test run and publish. If our
elevation or windage differs by more than **0.1 mil** at any row, the test fails
and the site is not published.

Never edit the numbers in these files or the 0.1 mil tolerance to make a test
pass. Investigate the difference instead (see CLAUDE.md).
