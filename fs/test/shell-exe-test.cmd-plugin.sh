#!/usr/bin/env bash
set -o errexit -o nounset -o pipefail

# first param in CLI is the "COMMAND" but also can be set in ENV by pubctl
COMMAND=${1:-${CMDPROXY_COMMAND:-inspect}}  
SCRIPT_HOME=${CMDPROXY_FS_HOME_REL:-.}
SCRIPT_NAME=${CMDPROXY_FS_NAME:-`basename $0`}
DEST=test.auto.md

case $COMMAND in
  describe)
    echo "Describe what will be generated in '$DEST' in '$SCRIPT_HOME' by $SCRIPT_NAME"
    ;;

  generate)
    echo "Generate '$DEST' in '$SCRIPT_HOME' by $SCRIPT_NAME"
    ;;

  *)
    echo "unknown $SCRIPT_NAME hook step '$COMMAND' in $SCRIPT_HOME"
    ;;
esac
