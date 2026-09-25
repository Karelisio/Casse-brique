# Casse-Brique

Jeu de casse-briques réaliste pour mobile. C'est une web app (PWA) installable qui fonctionne hors ligne, et elle est prête à être empaquetée par Capacitor pour Android et iOS.

Techno : Vite + TypeScript, rendu en Canvas 2D et physique écrite pour le jeu, sans moteur externe. Aucun serveur.

## Lancer en local
```bash
npm install
npm run dev          # http://localhost:5173 (+ adresse réseau pour tester sur téléphone)
npm test             # tests unitaires (physique anti-traversée, niveaux)
npm run build        # typecheck + build de production dans dist/
npm run preview      # sert dist/ (service worker actif)
npm run e2e          # test mobile de fumée (Playwright), à lancer avec preview démarré
```

## Déployer
- **GitHub Pages** : dans *Settings → Pages*, choisir *Source : GitHub Actions*. Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`. La config `base: './'` fait fonctionner le jeu dans un sous-dossier.
- **Netlify** : connecter le dépôt. `netlify.toml` fournit la commande de build (`npm run build`) et le dossier publié (`dist`). Sans connecter le dépôt : `npx netlify deploy --prod --dir=dist`.

## App native (Capacitor)
```bash
npm run cap:add:android      # une seule fois (ou cap:add:ios, sur Mac avec Xcode)
npm run cap:sync             # build + copie dans le projet natif
npm run cap:open:android     # ouvre Android Studio
```
En natif, `src/platform/` passe automatiquement par les plugins Capacitor : vibrations (Haptics), verrouillage portrait (ScreenOrientation), mise en pause en arrière-plan et bouton retour Android (App). Sur le web, les API du navigateur prennent le relais.

### APK automatique (GitHub Actions)
Le workflow `.github/workflows/android.yml` génère un APK installable (debug) à chaque push sur `main` et sur chaque PR :
*Actions → APK Android → dernier run → Artifacts → `casse-brique-apk`*.
Un tag `v*` (ex. `git tag v1.0.0 && git push --tags`) attache aussi l'APK à une release GitHub.
Sur le téléphone : autoriser « Installer des applis inconnues », puis ouvrir l'APK.

## Architecture
```
src/
  engine/    Game (état et règles), Loop (pas fixe à 120 Hz + rendu interpolé), config, Settings (localStorage)
  physics/   collide.ts : collision continue cercle/rectangle (la balle ne traverse jamais une brique)
  entities/  balle, raquette, briques, bonus, matériaux
  render/    Renderer (lumière, ombres, traînée), materials (textures pré-rendues), Fx (particules, fragments, secousse)
  input/     glisser tactile relatif, souris, clavier
  audio/     sons générés par Web Audio, propres à chaque matériau
  platform/  couche web / Capacitor (vibrations, orientation, cycle de vie)
  levels/    levels.json (10 niveaux) + procedural.ts (niveaux 11 et suivants, déterministes)
  ui/        menus DOM : Jouer, Niveaux, Réglages, Pause, fin de niveau, fin de partie
```

## Format des niveaux (`src/levels/levels.json`)
Chaque niveau est une grille de 10 colonnes :
- `G` verre (1 coup)
- `W` bois (2 coups)
- `S` pierre (3 coups)
- `M` métal (4 coups)
- `X` acier indestructible
- `E` explosif (réaction en chaîne)
- `.` vide

## Contrôles
- **Téléphone** : glisser n'importe où sur l'écran pour déplacer la raquette, relâcher pour lancer la balle.
- **Ordinateur** : souris, ou flèches et Espace. `P` / `Échap` met en pause.
