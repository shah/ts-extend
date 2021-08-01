#!/usr/bin/env bash
set -o errexit -o nounset -o pipefail

# Return the first and second parameter plus the value of TEST_EXTN_NAME environment variable
# mod_test.ts uses the text output to STDOUT as test case
echo "Hello World from shell executable plugin! (${1-noArg1} ${2-noArg2} ${TEST_EXTN_NAME-noEnvVar})"