#!/bin/bash
# Commit and push everything that currently passes: tools/harness/checkpoint.sh ["message"]
exec "$(dirname "$0")/safe-commit.sh" '^$' "${1:-Checkpoint work in progress}"
