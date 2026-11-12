# Zoo Wars : pipeline automatique

2 vidéos Hot Potato 3D par jour, programmées sur TikTok et YouTube Shorts via Buffer, contrôlées chaque soir.

| Dossier | Contenu |
|---|---|
| `engine/` | le jeu tel quel (moteur, musique, `grender.js`, notice) : **ne pas modifier sans accord** |
| `src/` | `producer.js`, `publisher.js`, `monitor.js`, `orchestrator.js`, `captions.js`, `lib.js` |
| `.claude/agents/` | les 3 sous-agents (video-producer, social-publisher, daily-monitor) |
| `CLAUDE.md` | l'orchestrateur : règles et déroulé quotidien |
| `config/config.json` | mode (test / draft / live), horaires, canaux Buffer, contrôle qualité, hashtags |
| `data/registry.json` | registre central (statuts, posts Buffer, empreintes) ; `data/logs/` journaux |
| `production/` | rendus bruts (non versionnés) |
| `approved/<date>/` | fiches des vidéos validées (le MP4 est publié sur la branche `media`) |
| `buffer/<date>/` | légendes, requêtes envoyées et réponses réelles de Buffer |
| `archives/` | vidéos publiées archivées |
| `reports/` | rapports quotidiens du moniteur |

Commandes utiles :

```
node src/orchestrator.js status 7     # où en est chaque vidéo
node src/orchestrator.js week         # bilan des 7 derniers jours
node src/producer.js run 2026-11-20   # produire une date à la main
node src/monitor.js check             # contrôle de demain (avec --buffer <fichier>)
```

Changer les horaires : `config.slots` (heure de Paris). Passer en réel : `config.mode` = `draft` (brouillons Buffer, rien n'est publié) puis `live`.
