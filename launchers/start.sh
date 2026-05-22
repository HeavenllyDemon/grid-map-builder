#!/bin/sh
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$APP_DIR"

GRID_MAP_BUILDER_OPEN=1 node portable/server.mjs
