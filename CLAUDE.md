# Zoo Wars : orchestrateur de production et de publication

Ce dépôt fait tourner la chaîne Zoo Wars : **3 vidéos par jour**, publiées sur TikTok (`zoowarsdaily`) et sur YouTube Shorts (`Zoo Wars`) via Buffer, à l'heure de Paris :
- 12:30 et 19:00 : Hot Potato 3D (`engine/`) ;
- 16:00 : une simulation 2D de l'arène (`engine2d/`), en rotation Territory War, Color War et Hot Potato 2D. Big Eats Small n'est pas utilisé.

- **dimanche 18:00** (à partir du 22/11/2026) : la vidéo **Classement** de la semaine (`standings/`), 4e vidéo du dimanche.

Cela fait 22 vidéos uniques et 44 publications par semaine.

### Saison et classement (validés par le propriétaire le 13/11/2026)
- **Gagnants naturels.** Le gagnant de chaque vidéo 3D est tiré au sort avec les vraies chances du jeu (`production.winOdds`, environ 1/8 chacun). On garde ensuite la meilleure des 600 parties gagnées par cet animal. Il ne faut jamais choisir un gagnant pour équilibrer ou arranger le classement.
- **Saisons** de 4 semaines à partir du lundi 16/11/2026. Seules les victoires Hot Potato 3D comptent (`src/standings.js`).
- **Où le classement apparaît :**
  - une ligne « Season leader » dans les légendes 3D ;
  - la ligne « SEASON n · #rang · x WINS » sous « X WINS! » à la fin des vidéos 3D, passée au jeu par `STANDING` ;
  - la vidéo Classement du dimanche.

Claude est l'orchestrateur. Il lance les trois agents, dans `.claude/agents/`, dans l'ordre ci-dessous. Les scripts de `src/` font tout le travail déterministe. Seuls les appels Buffer passent par le connecteur MCP Buffer officiel.

## Règles absolues
1. **Ne jamais modifier les jeux** (`engine/`, `engine2d/arena.html`), ni inventer un mode de jeu, sans autorisation écrite du propriétaire. Seule modification autorisée à ce jour (13/11/2026) : la ligne de classement sur l'écran de fin du jeu 3D.
2. **Une vidéo non validée n'est jamais publiée.** `publisher.js payload` refuse tout ce qui n'est pas `uploaded` avec un contrôle qualité réussi. Ne jamais contourner ce refus.
3. **Une publication n'est « scheduled » qu'avec l'identifiant renvoyé par Buffer**, enregistré par `publisher.js record`.
4. **Jamais deux fois la même vidéo sur le même canal.** Avant chaque `create_post`, lister les posts Buffer du canal et passer le fichier à `payload --existing`. S'il refuse avec DUPLICATE BLOCKED, ne rien créer.
5. **Statut incertain = on ne publie pas.** C'est le cas si `create_post` échoue ou ne répond pas : ne pas réessayer à l'aveugle. Lister d'abord les posts du canal. Si le post existe, lancer `record` ; s'il n'existe pas, recréer.
6. Ne jamais supprimer une vidéo validée ni un fichier de `approved/` ou de la branche `media`. Seul le moniteur peut supprimer un post Buffer, et uniquement un **doublon** au statut scheduled qui n'est pas celui du registre.
7. Ne jamais afficher, écrire ni committer de clé ou de jeton. Le dépôt est public, et le gagnant ne doit apparaître ni dans les légendes ni dans les noms de fichiers.
8. Respecter `config/config.json` : `mode` vaut test, draft ou live. En mode test, aucun appel `create_post`, `edit_post` ni `delete_post`.

## Statuts (registre `data/registry.json`)
Vidéo : `planned → produced → validated → uploaded → scheduled → published`, ou `error`.
Publication (une par vidéo et par canal) : `prepared → scheduled → published`, ou `error` / `needs_review`.

## Exécution quotidienne (tâche planifiée, vers 21 h)

### Règle de production (validée par le propriétaire le 12/11/2026)
Chaque soir, on regarde dans Buffer si les jours J+1 et J+2 sont **complets**. Un jour est complet quand toutes ses vidéos sont programmées sur TikTok et sur YouTube, soit 3 vidéos × 2 canaux = 6 publications.

| Ce qu'on trouve dans Buffer | Ce qu'on produit |
|---|---|
| J+1 et J+2 complets | rien, contrôle seulement |
| seul J+1 complet | J+2 et J+3 |
| seul J+2 complet | J+1 et J+3 |
| aucun des deux (démarrage) | J+1, J+2 et J+3 |

- Un jour à moitié programmé n'est pas complet. On complète seulement ce qui manque, sans refaire ce qui est déjà programmé.
- Si la file Buffer est pleine (plan gratuit, 10 publications par canal), on ne programme pas à moitié : on envoie une alerte.

### Déroulé
1. **Préparation**
   - Cloner le dépôt s'il n'est pas déjà là.
   - Si `media/` n'existe pas : `git fetch origin +media:refs/remotes/origin/media && git worktree add media origin/media -B media`.
   - `list_posts` sur les deux canaux, avec `dueAt` de J+1 00:00 à J+3 23:59 (tous statuts), sauvegardé dans `buffer/plan-<date>.json`.
   - `node src/orchestrator.js plan-today --buffer buffer/plan-<date>.json`. La commande affiche l'état de J+1, J+2 et J+3, puis les dates à produire (`PRODUCE`) ou `NOTHING TO PRODUCE`.
2. **Production** (agent video-producer), pour chaque date `PRODUCE`, une date après l'autre :
   - lancer `node src/producer.js run <date>` en arrière-plan ;
   - attendre la ligne `PRODUCER_RESULT`, soit environ 50 min par date (3D en mode « full », environ 24 min par vidéo) ;
   - enchaîner tout de suite la publication de cette date (étape 3) avant de passer à la date suivante ;
   - enregistrer l'avancement avec `node src/orchestrator.js save "producer <date>"`.
3. **Publication** (agent social-publisher), pour chaque vidéo validée de ces dates :
   - mettre en ligne ;
   - écrire les légendes ;
   - préparer la requête ;
   - appeler `create_post` ;
   - lancer `record`.
4. **Contrôle** (agent daily-monitor) de J+1 : lister les posts Buffer, lancer `monitor.js check`, appliquer les corrections sûres, puis relancer le contrôle.
5. **Synchronisation** des posts passés :
   - `list_posts` (statuts sent ou error, 3 derniers jours), sauvegardé dans `buffer/sync-<date>.json` ;
   - `node src/publisher.js sync <fichier>` ;
   - **statistiques** : `list_posts` des posts envoyés (statut sent, `includeMetrics: true`, toutes les pages), sauvegardé dans `buffer/metrics/sent-<date>.json`, puis `node src/analytics.js snapshot <fichier>` (relevé quotidien utilisé par le rapport du dimanche) ;
   - `node src/orchestrator.js prune-media` : ne fait rien tant que `media.pruneAfterPublished` vaut false ;
   - `node src/orchestrator.js save "daily run"`.
6. **Compte rendu** :
   - si le verdict est OK, un court message suffit ;
   - s'il y a une ALERTE ou une étape impossible, envoyer une notification claire au propriétaire : quoi, quelle vidéo ou publication, ce qui a été tenté, ce qu'il doit faire.

## Rapport hebdomadaire (tâche planifiée du dimanche)
L'agent `channel-analyst` analyse la semaine, du dimanche au samedi. Il croise les stats Buffer et, si le Mac est allumé, les données fines de TikTok Studio et YouTube Studio. Il rédige un document et propose 2 à 3 tests. **Aucun test n'est appliqué sans l'accord du propriétaire.** Les tests validés sont notés dans `data/experiments.json`.

## Reprise après erreur
Chaque étape est idempotente : relancer la même commande reprend là où le registre s'est arrêté. Une vidéo en erreur au rendu ou au contrôle qualité est refaite une fois automatiquement avec une autre partie. Le verrou `data/registry.json.lock` expire au bout de 30 min.

## Repères
- Buffer : organisation « My organization » `6af60d1f91eb89558077e389`. Plan gratuit, donc 10 posts au plus en file par canal : avec la règle des 3 jours, on monte à 9 au maximum.
- Horaires : `config.slots`, soit 12:30, 19:00 et 16:00 ; le jeu de chaque créneau est dans `config.slotGames`. Pour les changer, modifier la configuration ; les vidéos déjà programmées ne bougent pas.
- Journaux : `data/logs/<date>.log`. Rapports : `reports/`. Requêtes et réponses Buffer : `buffer/<date>/`.
- Le moteur et sa notice : `engine/` (rendu : `engine/grender.js`, 9 à 12 min par vidéo).
