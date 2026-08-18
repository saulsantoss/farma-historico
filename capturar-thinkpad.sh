#!/bin/bash
cd /home/innsa/farma-historico || exit 1
echo "===== $(date -u +%Y-%m-%dT%H:%MZ) ====="
/usr/bin/node captura.js || echo "captura fallo, se sube lo que haya"
git add -A
git diff --cached --quiet && echo "sin cambios, no se commitea" && exit 0
git commit -m "captura $(date -u +%Y-%m-%dT%H%MZ) desde desktop"
git pull --rebase || { echo "pull fallo"; exit 1; }
git push || { echo "push fallo"; exit 1; }
echo "subido ok"
