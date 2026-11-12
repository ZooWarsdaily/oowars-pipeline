# Zoo Wars : orchestrateur de production et de publication

Ce dépôt fait tourner la chaîne Zoo Wars : **2 vidéos Hot Potato 3D par jour**, publiées sur TikTok (`zoowarsdaily`) et sur YouTube Shorts (`Zoo Wars`) via Buffer. Cela fait 14 vidéos uniques et 28 publications par semaine, à l'heure de Paris.

Claude est l'orchestrateur. Il lance les trois agents, dans `.claude/agents/`, dans l'ordre ci-dessous. Les scripts de `src/` font tout le travail déterministe. Seuls les appels Buffer passent par le connecteur MCP Buffer officiel.

## Règles absolues
1. **Ne jamais modifier le jeu** (`engine/`), ni inventer un mode de jeu, sans autorisation écrite du propriétaire.
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
1. **Préparation**
   - Cloner le dépôt s'il n'est pas déjà là.
   - `git fetch origin media && git worktree add media origin/media -B media`, si `media/` n'existe pas encore.
   - `node src/orchestrator.js plan-today`.
2. **Production** (agent video-producer), pour chaque date « PRODUCE » (J+1 si elle manque, J+2 normalement) :
   - lancer `node src/producer.js run <date>` en arrière-plan ;
   - attendre la ligne `PRODUCER_RESULT`, soit environ 25 min pour 2 vidéos ;
   - après chaque rendu, enregistrer l'avancement avec `node src/orchestrator.js save "producer <date>"`.
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
   - `node src/orchestrator.js prune-media` : ne fait rien tant que `media.pruneAfterPublished` vaut false ;
   - `node src/orchestrator.js save "daily run"`.
6. **Compte rendu** :
   - si le verdict est OK, un court message suffit ;
   - s'il y a une ALERTE ou une étape impossible, envoyer une notification claire au propriétaire : quoi, quelle vidéo ou publication, ce qui a été tenté, ce qu'il doit faire.

## Reprise après erreur
Chaque étape est idempotente : relancer la même commande reprend là où le registre s'est arrêté. Une vidéo en erreur au rendu ou au contrôle qualité est refaite une fois automatiquement avec une autre partie. Le verrou `data/registry.json.lock` expire au bout de 30 min.

## Repères
- Buffer : organisation « My organization » `6af60d1f91eb89558077e389`. Plan gratuit, donc 10 posts au plus en file par canal : on programme au fil de l'eau, J+2 au maximum.
- Horaires : `config.slots`, soit 12:30 et 19:00. Pour les changer, modifier la configuration ; les vidéos déjà programmées ne bougent pas.
- Journaux : `data/logs/<date>.log`. Rapports : `reports/`. Requêtes et réponses Buffer : `buffer/<date>/`.
- Le moteur et sa notice : `engine/` (rendu : `engine/grender.js`, 9 à 12 min par vidéo).
