# Zoo Wars – Infection 3D : notice de fabrication des vidéos

Cette notice permet à n'importe quelle conversation du projet de fabriquer des vidéos « Infection 3D » pour la chaîne Zoo Wars, sans rien reconstruire. Le jeu se joue à 8 animaux, comme Hot Potato 3D. Il compte au classement de la saison depuis le 14/11/2026 (voir la fin de cette notice).

## Le jeu

- **8 animaux** choisis parmi les 15 (même système d'équipe que Hot Potato 3D).
- Une goutte de slime vert tombe sur un animal tiré au hasard : il est contaminé, devient vert et pourchasse les autres.
- Chaque animal touché devient vert à son tour (1,6 s de transformation) et rejoint la meute.
- **Le dernier animal sain gagne.** Il y a donc 6 contaminations après la première.
- Le rythme : après chaque contamination, la meute fête sa prise pendant 2,6 s, puis repart lentement et accélère de plus en plus jusqu'à la prise suivante. La barre en haut de l'écran montre cette accélération.
- À l'écran : « LAST ONE CLEAN WINS! » au début, puis le nombre d'animaux sains restants, et la carte « LAST 2 CLEAN! » quand il n'en reste que deux. Les contaminés ont leur nom, leur corps et leur portrait en vert.

## Les caractères

Ce sont ceux de Hot Potato 3D, qu'ils fuient ou qu'ils chassent : le renard esquive, le panda roule, la tortue se cache 2 s dans sa carapace (on ne peut pas la contaminer), le lapin zigzague, le gorille bondit sur sa proie, le crocodile guette près des rochers, la grenouille contamine à distance avec sa langue, l'éléphant avec sa trompe.

## Durée et équilibre (mesurés le 13/11/2026)

- **Durée** : elle varie beaucoup d'une partie à l'autre (médiane 54 s, de 41 à 74 s). Environ **une partie sur trois dure entre 55 et 68 s** : le mode `auto` ne garde que celles-là, et préfère celles où les prises sont bien espacées.
- **Équilibre** : sur 2 400 parties avec 8 animaux tirés au hasard parmi les 15, chaque animal gagne entre **10,5 % et 14,8 %** des parties qu'il joue (cible : 12,5 %). La mesure est moins fine que pour les autres jeux ; à refaire sur plus de parties avant de faire compter ce jeu au classement.

Les réglages sont dans `index.html`, partie « INFECTION – game simulation » : caractères `TRAIT`, équilibre `BAL` (vitesse de fuite), vitesse de la meute `HS`, pause `PAUSE`, accélération `RAMP`. Après tout changement, refaire la mesure avec `HP.previewGame`.

## Où sont les fichiers

Tout est dans la page publiée **« Zoo Wars – Infection 3D »** (artefact, slug `c94fd060-5035-4713-901a-ad9c16238c14`) :
- `index.html` : le jeu complet ;
- `music/` : la même bande-son que Hot Potato 3D ;
- `grender.js` : le script qui fabrique une vidéo (le même que celui de Hot Potato 3D) ;
- `NOTICE.md` : cette notice.

Pour récupérer les fichiers, procéder comme pour Hot Potato 3D : outil Artifact `read_file`, 4 Mo au plus par appel. Mettre `index.html` et `music/` dans un dossier `inf/`, et `grender.js` à côté de ce dossier.

## Fabriquer une vidéo

```
GAME=inf node grender.js auto Sortie.mp4 30 any any full                # une partie bien rythmée, décor au hasard
GAME=inf node grender.js auto Sortie.mp4 30 panda ice full              # gagnée par le panda, sur la banquise
GAME=inf ROSTER=elephant,penguin,kangaroo,turtle,crocodile,frog,rabbit,panda node grender.js auto Sortie.mp4 30 any any full
GAME=inf node grender.js 12345 Sortie.mp4 30 any jungle full            # rejoue exactement la partie n° 12345
```

- Paramètres : graine (ou `auto`), fichier de sortie, images par seconde, gagnant (ou `any`), décor (ou `any`), puis `fast` ou `full`. `ROSTER` donne les 8 animaux (sinon l'équipe d'origine).
- **Gagnant** : ne jamais le choisir à la main. Le tirer au sort (1 chance sur 8 chacun), puis le passer en 4e paramètre. Si `auto` répond `NO GAME FOUND`, relancer : il cherche parmi 400 parties.
- Résultat : MP4 1080 × 1920, 30 images/s, H.264, son AAC 256 kb/s. Compter environ 20 minutes par vidéo en `full`. Lancer en arrière-plan et attendre la ligne `DONE`.
- Légendes en anglais, sans révéler le gagnant. Hashtags : `#zoowars #infection #animalbattle #whowouldwin #simulation #satisfying`.

## La musique

Même bande-son dynamique que Hot Potato 3D, mélodie jamais modifiée. L'intensité monte à chaque contamination (événement `stage`) : montée à 6 animaux sains, partie intense à 4, duel à 2, accord final sur la victoire.

## En production (depuis le 14/11/2026)

- Infection 3D passe au créneau de **12:30**, en alternance avec Musical Chairs 3D, à partir du 17/11/2026. Il est dans le dépôt du système automatique (`games/infection/`) et **compte au classement de la saison**, comme Hot Potato 3D et Musical Chairs 3D (1 victoire = 1 point).
- Le gagnant est tiré au sort d'abord, avec les chances naturelles du jeu mesurées sur les parties de 55 à 68 s avec les 8 animaux d'origine (`config.production.games["infection-3d"].winOdds`) : de 10,8 % (ours) à 14,8 % (panda). On garde ensuite la meilleure partie gagnée par cet animal.
- L'équilibre a été légèrement retouché le 14/11/2026 pour l'équipe d'origine (loup et panda relevés, gorille et renard abaissés).
