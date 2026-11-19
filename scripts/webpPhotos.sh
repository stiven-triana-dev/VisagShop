#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../public/img"
mkdir -p w
for f in p[0-9][0-9][0-9].jpg; do
  b=${f%.jpg}
  if [[ "${1:-}" == "--force" || ! -f "w/$b.webp" ]]; then convert "$f" -strip -quality 80 -define webp:method=6 "w/$b.webp"; fi
  if [[ "${1:-}" == "--force" || ! -f "w/$b-360.webp" ]]; then convert "$f" -strip -resize 360x -quality 78 -define webp:method=6 "w/$b-360.webp"; fi
done
echo "Listo: $(ls w | wc -l) archivos en public/img/w/"
