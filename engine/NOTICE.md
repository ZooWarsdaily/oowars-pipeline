# Zoo Wars – Hot Potato 3D : notice de fabrication des vidéos

Cette notice permet à n'importe quelle conversation du projet de fabriquer des vidéos « Hot Potato 3D » pour la chaîne TikTok Zoo Wars, sans rien reconstruire.

## Le jeu

8 animaux-personnages par partie, choisis parmi 15, chacun avec son accessoire, sa façon de jouer et son geste. L'équipe par défaut est lion, tiger, bear, wolf, gorilla, fox, bull, panda. Une autre équipe se passe par l'adresse : `index.html?roster=elephant,penguin,kangaroo,turtle,crocodile,frog,rabbit,panda` (8 animaux différents, sinon l'équipe par défaut). Pour les vidéos, la variable `ROSTER` de `grender.js` fait la même chose.

Les 7 animaux ajoutés le 13/11/2026 :
- **Elephant** (The Wall) : lent, mais touche de loin avec sa trompe.
- **Penguin** (The Slider) : glisse sur le ventre en ligne droite et tourne mal.
- **Kangaroo** (The Hopper) : avance par bonds et saute par-dessus les rochers.
- **Turtle** (The Shell) : une fois par bombe, se cache 2 s dans sa carapace. Pendant ce temps, il est intouchable et immobile.
- **Crocodile** (The Ambusher) : guette près des rochers et bondit à ras du sol sur sa proie.
- **Frog** (The Tongue) : passe la bombe à distance avec sa langue.
- **Rabbit** (The Zigzag) : fuit en zigzag très vite, mais s'essouffle.

Équilibre mesuré sur 4 000 parties avec des équipes tirées au hasard parmi les 15 : chaque animal gagne entre 11,4 % et 13,9 % des parties qu'il joue. L'équipe par défaut joue exactement comme avant. Ils courent sur un plateau suspendu. Celui qui porte la bombe doit toucher un autre animal pour la lui passer, et le porteur explose quand la mèche arrive au bout. Il y a 7 explosions et un seul gagnant. Une partie dure environ 64 s.

Quatre décors : volcano, ice, jungle, space. Tout le texte à l'écran est en anglais. La photo d'équipe « PICK YOUR ANIMAL! » ouvre la partie, et la question de fin invite à commenter.

## Où sont les fichiers

Tout est dans la page publiée **« Zoo Wars – Hot Potato 3D (bande-son dynamique) »** (artefact, slug `8d2177c1-7157-44d7-bd2e-71a326776aab`). L'ancienne page « Zoo Wars – Hot Potato 3D », sans la bande-son, est publique et ne peut plus être modifiée par Claude.

La page contient :

- `index.html` : le jeu complet (moteur 3D, simulation, affichage, sons, chef d'orchestre musical) ;
- `music/cues.json` et 10 fichiers `music/*.wav` : la bande-son, sans perte ;
- `grender.js` : le script qui fabrique une vidéo ;
- `NOTICE.md` : cette notice.

Pour les récupérer dans l'espace de travail, utiliser l'outil Artifact `read_file` avec `slug` et `paths`. Il accepte 4 Mo au plus par appel, donc faire 9 appels :

1. `index.html`, `grender.js`, `music/cues.json`
2. `music/A_main.wav`
3. `music/A_perc.wav`
4. `music/B_main.wav`
5. `music/B_perc.wav`
6. `music/C1_main.wav`
7. `music/C1_perc.wav`
8. `music/C2_main.wav`, `music/H_main.wav`
9. `music/C2_perc.wav`, `music/H_perc.wav`

Recopier ensuite les fichiers reçus dans un dossier `dist/`, en gardant `music/` comme sous-dossier : `dist/index.html`, `dist/music/…`, et `grender.js` à côté de `dist/`.

## Fabriquer une vidéo

Outils nécessaires, déjà présents dans l'espace de travail (ne rien installer) : `node`, Playwright (`/opt/npm-tools/node_modules/playwright`), `/usr/bin/google-chrome`, `ffmpeg`.

```
node grender.js auto Sortie.mp4 30 any any           # une belle partie au hasard, décor au hasard
node grender.js auto Sortie.mp4 30 panda ice         # gagnée par le panda, sur la banquise
node grender.js 12345 Sortie.mp4 30 any jungle       # rejoue exactement la partie n° 12345
```

- Paramètres : graine (ou `auto`), fichier de sortie, images par seconde, gagnant (ou `any`), décor (ou `any`), puis `fast` (par défaut) ou `full` en 7e paramètre.
- Résultat : MP4 1080 × 1920, 30 images/s, H.264, son stéréo AAC 256 kb/s.
- **Environ 9 à 12 minutes par vidéo.** Lancer la commande en arrière-plan et attendre la ligne `DONE`. Une seule vidéo à la fois.
- `auto` choisit une partie animée : au moins une passe par manche, beaucoup de passes au total.
- Si la musique ne se charge pas, le script s'arrête avec `MUSIC NOT LOADED` : vérifier que le dossier `music/` est bien à côté de `index.html`.

## Règles de production (préférences de l'utilisateur)

- Varier les gagnants et les décors d'une vidéo à l'autre : imposer le gagnant (4e paramètre) et le décor (5e).
- Ne jamais révéler le gagnant dans la légende ni dans le nom du fichier.
- Légendes en anglais, avec les hashtags `#zoowars #hotpotato #animalbattle #whowouldwin #simulation #satisfying`.
- Déposer les vidéos dans le dossier « videos » de l'ordinateur de l'utilisateur, un sous-dossier par jour, avec un fichier de légendes par jour.

## La bande-son dynamique

La musique de référence (`zoo_wars_heroic_wild_v4.wav`, 118 BPM, mesures de 2,034 s) est découpée en phrases de 2 mesures, **jamais modifiées**. Un chef d'orchestre choisit la phrase suivante selon l'intensité de la partie :

| Section | Extrait du morceau | Quand |
|---|---|---|
| start | thème A (mesures 0–5) | dès la première image |
| rise | thème B (mesures 8–13), percussions croissantes | 1re élimination (ou après 14 s sans élimination) |
| intense | partie C (mesures 16–23, fichier C1), cuivres et rythme soutenu, impact à l'entrée | 4 survivants |
| duel | partie C (mesures 24–27, fichier C2, puis 20–23), toutes les couches au maximum, impact à l'entrée | 2 survivants |
| victoire | accord du climax (mesure 14) avec réverbération | à l'apparition de « X WINS! » |

- **Les événements commandent, le temps ne fait qu'aider.** Chaque explosion fixe un plancher d'intensité selon le nombre de survivants. Le temps fait monter l'intensité doucement dans les parties longues, sans jamais déclencher le duel tout seul.
- **Transitions sur la grille du tempo**, tous les 2 temps (environ 1 s), avec fondu enchaîné. Une même section reste au moins 2 s : une rafale d'événements produit un seul changement.
- **Couches** : une couche percussions (extraite du morceau, calée à l'échantillon près), un renfort des graves, de la présence des cuivres et de la brillance. Elles montent avec l'intensité.
- La musique baisse de 6 dB sous chaque explosion. À la dernière explosion, elle se retire, puis l'accord final éclate sur la victoire.
- En vidéo, toute la bande-son est recalculée après la partie à partir du journal des événements : le résultat est identique à ce qu'on entend en direct.

### Changer la musique

Tous les réglages sont dans `MUSIC_CFG`, au début de la partie « DYNAMIC SOUNDTRACK » de `index.html` : sections, phrases, seuils, couches, volumes. Les fichiers sont décrits dans `music/cues.json`.

Pour une autre musique au même tempo et avec la même structure, il suffit de remplacer les fichiers WAV (mêmes noms). Pour une musique différente :

1. Mesurer son tempo et son premier temps fort.
2. Découper les extraits sur les mesures (fichier `*_main` = extrait original sans perte, fichier `*_perc` = sa partie percussions). Garder chaque fichier sous 4 Mo, pour qu'il reste récupérable avec `read_file`.
3. Mettre à jour `cues.json` (bpm, mesures) et les phrases de `MUSIC_CFG`.

Si des pistes séparées (cuivres, cordes) existent un jour, elles peuvent devenir de vraies couches : il faut les ajouter à côté de `main` et `perc`.

## Régler le jeu

`index.html` contient, repérés par des commentaires : le moteur 3D (`Tiny 3D engine`), la simulation (`game simulation` : mèches `FUSE`, plateau `RINGS`, caractères `TRAIT`, équilibrage `BAL`), la musique (`DYNAMIC SOUNDTRACK`) et l'affichage (personnages `figure`, décors `THEME_DEF`, caméra, textes, sons `SND`).

Après tout changement de la simulation, vérifier sur quelques centaines de parties avec `HP.previewGame` que la durée, les passes et l'équilibre des victoires (environ 12,5 % par animal) tiennent toujours.
