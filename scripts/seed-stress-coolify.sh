#!/usr/bin/env bash

set -euo pipefail

: "${STRESS_SEED_TARGET_ROWS:=10000000}"
: "${STRESS_SEED_BATCH_SIZE:=10000}"

export STRESS_SEED_TARGET_ROWS
export STRESS_SEED_BATCH_SIZE

npx tsx stress-seed.ts
