#!/usr/bin/env bash
# Used as Vercel "Ignore Build Step" so Git-triggered builds are skipped.
# Deploys only happen when CI/CD runs the deploy step (Vercel API).
# See docs/DEPLOYMENT.md and docs/BRANCH_AND_PR_WORKFLOW.md
echo "Skipping Vercel Git build; production deploys only via CI/CD."
exit 1
