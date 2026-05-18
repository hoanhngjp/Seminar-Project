#!/usr/bin/env bash
# Elasticsearch seed: delegate to Python script for correct UTF-8 handling
# Run from repo root: bash infra/seed/elasticsearch_seed.sh

set -e

SEED_DIR="$(cd "$(dirname "$0")" && pwd)"

ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://localhost:9200}" \
  python3 "$SEED_DIR/elasticsearch_seed.py"
