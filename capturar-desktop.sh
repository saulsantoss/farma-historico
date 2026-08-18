#!/bin/bash
cd /home/innsa/farma-historico || exit 1
echo "===== $(date -u +%Y-%m-%dT%H:%MZ) ====="
/usr/bin/node captura.js || echo "captura fallo, se sube lo que haya"
git add -A
if git diff --cached --quiet; then
  echo "sin capturas nuevas, no se commitea"
else
  git commit -m "captura $(date -u +%Y-%m-%dT%H%MZ) desde desktop"
fi
git pull --rebase || { echo "pull fallo"; exit 1; }
# Solo esta maquina regenera web/public/, y lo hace despues del pull para que
# el agregador vea tambien el crudo que subio el thinkpad.
/usr/bin/node agregador.js || echo "agregador fallo, se sube el crudo sin regenerar web/public"
git add -A
if git diff --cached --quiet; then
  echo "web/public sin cambios"
else
  git commit -m "web/public regenerado $(date -u +%Y-%m-%dT%H%MZ)"
fi
git push || { echo "push fallo"; exit 1; }
echo "subido ok"
