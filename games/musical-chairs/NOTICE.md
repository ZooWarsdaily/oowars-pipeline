# Zoo Wars – Musical Chairs 3D : notice de fabrication des vidéos

Cette notice permet à n'importe quelle conversation du projet de fabriquer des vidéos « Musical Chairs 3D » pour la chaîne Zoo Wars, sans rien reconstruire. Le jeu se joue à 8 animaux, comme Hot Potato 3D. Il compte au classement de la saison depuis le 14/11/2026 (voir la fin de cette notice).

## Le jeu

- **8 animaux** choisis parmi les 15 (même système d'équipe que Hot Potato 3D).
- La musique joue : les animaux dansent en rond autour des coussins. Il y a toujours **un coussin de moins que d'animaux**.
- **La musique s'arrête** (vraiment : la bande-son est coupée) : tout le monde se rue sur un coussin. Celui qui reste debout est éliminé.
- Un coussin disparaît, la musique reprend. Il y a 7 manches et un seul gagnant.
- La durée de la musique change à chaque manche (de 2 à 5 s environ), pour qu'on ne puisse pas deviner l'arrêt.
- Quand deux animaux arrivent ensemble sur un coussin, ils se bousculent : le plus lourd a l'avantage, mais pas la certitude.
- Une partie dure environ **61 s** (presque toutes entre 57 et 65 s).
- À l'écran : « MUSIC STOPS = GRAB A CUSHION! » au début, un grand « STOP! » à chaque arrêt, et un petit témoin vert (musique) ou rouge (silence). Aucun texte pendant les éliminations.

## Les caractères

| Animal | Ce qu'il fait |
|---|---|
| Lion | frime à l'extérieur du cercle, réagit tard, court vite |
| Tiger | départ explosif |
| Bear | lent, mais presque impossible à déloger |
| Wolf | rôde près des coussins, se venge de celui qui l'a bousculé |
| Gorilla | bondit sur un coussin de loin |
| Fox | devine l'arrêt de la musique, mais léger dans les bousculades |
| Bull | charge tout droit, dérape parfois à côté du coussin |
| Panda | danse mollement près des coussins et roule dessus |
| Elephant | lent, se hisse sur un coussin avec sa trompe |
| Penguin | glisse sur le ventre jusqu'au coussin |
| Kangaroo | avance par bonds |
| Turtle | très lente, donc danse collée aux coussins |
| Crocodile | bondit à ras du sol sur les derniers mètres |
| Frog | colle sa langue sur un coussin et s'y propulse |
| Rabbit | très rapide, mais distrait |

## Équilibre (mesuré le 13/11/2026)

Sur 6 000 parties avec 8 animaux tirés au hasard parmi les 15, chaque animal gagne entre **11,1 % et 13,7 %** des parties qu'il joue (cible : 12,5 %). Il y a en moyenne 6 bousculades par partie.

Les réglages sont dans `index.html`, partie « MUSICAL CHAIRS – game simulation » : caractères `TRAIT`, équilibre `BAL` (agit sur la vitesse et le temps de réaction). Après tout changement, refaire la mesure sur quelques milliers de parties avec `HP.previewGame`.

## Où sont les fichiers

Tout est dans la page publiée **« Zoo Wars – Musical Chairs 3D »** (artefact, slug `159a0430-c83c-44ba-8990-84c6e682758c`) :
- `index.html` : le jeu complet ;
- `music/` : la même bande-son que Hot Potato 3D ;
- `grender.js` : le script qui fabrique une vidéo (le même que celui de Hot Potato 3D) ;
- `NOTICE.md` : cette notice.

Pour récupérer les fichiers, procéder comme pour Hot Potato 3D : outil Artifact `read_file`, 4 Mo au plus par appel. Mettre `index.html` et `music/` dans un dossier `mc/`, et `grender.js` à côté de ce dossier.

## Fabriquer une vidéo

```
GAME=mc node grender.js auto Sortie.mp4 30 any any full                 # une partie animée, décor au hasard
GAME=mc node grender.js auto Sortie.mp4 30 panda ice full               # gagnée par le panda, sur la banquise
GAME=mc ROSTER=elephant,penguin,kangaroo,turtle,crocodile,frog,rabbit,panda node grender.js auto Sortie.mp4 30 any any full
GAME=mc node grender.js 12345 Sortie.mp4 30 any jungle full             # rejoue exactement la partie n° 12345
```

- Paramètres : graine (ou `auto`), fichier de sortie, images par seconde, gagnant (ou `any`), décor (ou `any`), puis `fast` ou `full`. `ROSTER` donne les 8 animaux (sinon l'équipe d'origine).
- **Gagnant** : ne jamais le choisir à la main. Le tirer au sort (1 chance sur 8 chacun), puis le passer en 4e paramètre : `auto` garde alors la partie la plus animée gagnée par cet animal.
- Résultat : MP4 1080 × 1920, 30 images/s, H.264, son AAC 256 kb/s. Compter environ 20 minutes par vidéo en `full`. Lancer en arrière-plan et attendre la ligne `DONE`.
- Légendes en anglais, sans révéler le gagnant. Hashtags : `#zoowars #musicalchairs #animalbattle #whowouldwin #simulation #satisfying`.

## La musique

Même bande-son dynamique que Hot Potato 3D, mélodie jamais modifiée. Deux différences :
- à chaque arrêt, la musique est coupée net (événement `mstop`), puis reprend à la manche suivante (`mgo`). Elle continue d'avancer pendant le silence, pour rester calée sur le tempo ;
- l'intensité monte avec le nombre d'animaux restants (événement `stage`), comme les explosions dans Hot Potato.

## En production (depuis le 14/11/2026)

- Musical Chairs 3D passe au créneau de **12:30**, en alternance avec Infection 3D, à partir du 17/11/2026. Il est dans le dépôt du système automatique (`games/musical-chairs/`) et **compte au classement de la saison**, comme Hot Potato 3D et Infection 3D (1 victoire = 1 point).
- Le gagnant est tiré au sort d'abord, avec les chances naturelles du jeu mesurées sur 5 000 parties avec les 8 animaux d'origine (`config.production.games["musical-chairs-3d"].winOdds`) : de 10,6 % (gorille) à 14,0 % (panda). On garde ensuite la meilleure partie gagnée par cet animal.
