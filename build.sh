#!/bin/bash
# ScaledAIOps — Static Site Builder
# Assembles pages from _layout/ partials and _content/ source files into dist/

set -euo pipefail

# Feature toggle: FFRS ships the feedback widget + /feedback/ page (live since 2026-08-18). FFRS_ENABLED=false = zero FFRS bytes.
FFRS_ENABLED="${FFRS_ENABLED:-true}"
FFRS_TURNSTILE_SITEKEY="${FFRS_TURNSTILE_SITEKEY:-0x4AAAAAAEUQz0HJ_ZRQDr3H}"  # public site key

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAYOUT_DIR="$SCRIPT_DIR/_layout"
CONTENT_DIR="$SCRIPT_DIR/_content"
DIST_DIR="$SCRIPT_DIR/dist"

# Clean and prepare dist
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy static assets
cp -r "$SCRIPT_DIR/assets" "$DIST_DIR/assets"

if [ "$FFRS_ENABLED" = "true" ]; then
  FFRS_WIDGET="  <link rel=\"stylesheet\" href=\"/assets/css/ffrs-widget.css\">
  <script src=\"/assets/js/ffrs-widget.js\" data-endpoint=\"/api/feedback\" data-site=\"scaledaiops.org\" data-turnstile=\"$FFRS_TURNSTILE_SITEKEY\" defer></script>"
else
  FFRS_WIDGET=""
  rm -f "$DIST_DIR/assets/js/ffrs-widget.js" "$DIST_DIR/assets/css/ffrs-widget.css"
  rm -rf "$DIST_DIR/assets/js/vendor"
  rmdir "$DIST_DIR/assets/js" 2>/dev/null || true
fi

# Read layout partials
HEAD=$(cat "$LAYOUT_DIR/head.html")
HEADER=$(cat "$LAYOUT_DIR/header.html")
FOOTER=$(cat "$LAYOUT_DIR/footer.html")

# Find all content files (skip the FFRS page unless enabled)
find "$CONTENT_DIR" -name '*.html' | while read -r content_file; do
  case "$content_file" in "$CONTENT_DIR"/feedback/*) [ "$FFRS_ENABLED" = "true" ] || continue;; esac
  # Determine output path
  rel_path="${content_file#$CONTENT_DIR/}"
  out_file="$DIST_DIR/$rel_path"
  mkdir -p "$(dirname "$out_file")"

  # Extract metadata from comments
  title=$(grep '<!-- title:' "$content_file" | sed 's/<!-- title: \(.*\) -->/\1/')
  description=$(grep '<!-- description:' "$content_file" | sed 's/<!-- description: \(.*\) -->/\1/')
  active=$(grep '<!-- active:' "$content_file" | sed 's/<!-- active: \(.*\) -->/\1/')

  # Get content (everything after metadata lines)
  # Get content: skip metadata lines and leading blank lines
  body=$(awk '
    /^<!-- title:/ { next }
    /^<!-- description:/ { next }
    /^<!-- active:/ { next }
    started || /^./ { started=1; print }
  ' "$content_file")

  # Build head with title and description
  page_head=$(echo "$HEAD" | sed "s|{{TITLE}}|$title|g" | sed "s|{{DESCRIPTION}}|$description|g")

  # Build header with active nav
  page_header="$HEADER"
  for nav in disciplines principles roles about; do
    if [ "$nav" = "$active" ]; then
      page_header=$(echo "$page_header" | sed "s|{{ACTIVE_$nav}}| class=\"active\"|g")
    else
      page_header=$(echo "$page_header" | sed "s|{{ACTIVE_$nav}}||g")
    fi
  done

  # Assemble page
  {
    echo "$page_head"
    echo ""
    echo "$page_header"
    echo ""
    echo "$body"
    echo ""
    echo "${FOOTER//\{\{FFRS_WIDGET\}\}/$FFRS_WIDGET}"
  } > "$out_file"

  echo "  built: $rel_path"
done

echo ""
echo "Build complete → dist/  (FFRS_ENABLED=$FFRS_ENABLED)"
echo "Files: $(find "$DIST_DIR" -name '*.html' | wc -l | tr -d ' ') pages, $(find "$DIST_DIR/assets" -type f | wc -l | tr -d ' ') assets"
