# Matricule

Carnet d'entraînement (PWA) pour 15 mois de préparation à la sélection forces spéciales.
Les données restent sur le téléphone (IndexedDB), avec export et import JSON.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # moteur : progression, phases, streak, grades
npm run build      # dist/ + service worker
npm run icons      # régénère les icônes PNG
python e2e/shots.py && python e2e/scenarios.py && python e2e/programme.py   # captures iPhone (vite preview sur :4173 et dev sur :5173)
```

## Programme

Les 58 fiches viennent du PDF « Programme hybride 58 semaines », converti en données par :

```bash
pip install pypdf
python scripts/parse-programme.py chemin/vers/Programme_Hybride_58_semaines.pdf   # écrit src/data/programme.json
```

## Organisation

- `src/domain/` : règles métier pures et testées : fiches (`programme.ts`), décision du dimanche (`cursor.ts`), double progression en salle (`strength.ts`), bilans, streak, grades
- `src/db/` : schéma Dexie, génération des semaines, sauvegarde
- `src/features/` : écrans (Aujourd'hui, Plan, Consigner, Stats, Dossier)

## Installer sur iPhone

1. Ouvrir l'URL HTTPS de l'app dans **Safari**.
2. Toucher **Partager**, puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Lancer Matricule depuis l'icône : l'app s'ouvre en plein écran et fonctionne hors ligne.
4. Chaque semaine : Dossier, puis **Exporter une sauvegarde**, puis **Enregistrer dans Fichiers**.
