#!/usr/bin/env bash
# Deploy the site to S3 + CloudFront, then smoke-test production. Run by the TeamCity "Deploy" build (manual trigger).
# Refuses to run as anything but the deploy user (wrong-account guard).
#   scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Created by aiops-tf-infra (s3.tf, cloudfront.tf).
BUCKET=scaledaiops.org
DISTRIBUTION=EJE5SGJ73Q1SL
# The user's choice (2026-09-25): deploy as admin-cli, the key behind the local `scaledaiops` profile, also held by TeamCity.
DEPLOY_USER=arn:aws:iam::546155105471:user/admin-cli
export AWS_DEFAULT_REGION=eu-central-1 AWS_PAGER=""

aws --version | grep -q '^aws-cli/2\.' || { echo "AWS CLI v2 required" >&2; exit 1; }
identity=$(aws sts get-caller-identity --query Arn --output text)
[[ "$identity" == "$DEPLOY_USER" ]] || { echo "refusing to deploy as $identity — expected $DEPLOY_USER" >&2; exit 1; }

scripts/ci.sh # build dist/ and pass the E2E suite locally before anything goes live
[[ "$(uname -s)" == Linux ]] && source scripts/ci-tools.sh

aws s3 sync dist "s3://$BUCKET" --delete
invalidation=$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed --distribution-id "$DISTRIBUTION" --id "$invalidation"
echo "deployed $(find dist -name '*.html' | wc -l | tr -d ' ') pages to https://www.scaledaiops.org (invalidation $invalidation)"

npx playwright test --reporter=line # the full suite against production, incl. the 404 page and SSL redirects
