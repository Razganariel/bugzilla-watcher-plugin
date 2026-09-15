# bugzilla-watcher-plugin

**Firefox extension that monitors a Bugzilla 5.0.6+ instance and notifies you in real time (toast + sound) as soon as a new ticket matching your criteria enters the queue.**

**Extension Firefox qui surveille une instance Bugzilla 5.0.6+ et vous notifie en temps réel (toast + son) dès qu'un nouveau ticket correspondant à vos critères y entre.**

---

## Features / Fonctionnalités

**English**

- **New ticket detection**: the extension polls the REST API (`GET /rest/bug`) at the configured frequency and only alerts you about tickets it has never seen.
- **Toast + sound alerts**: native notification (toast) and a generated chime (or a custom MP3/WAV/OGG URL).
- **Fully configurable criteria**:
  - Product, component, status, severity, priority, resolution, assignee, creator, summary, version, target milestone, OS, platform, QA contact, whiteboard, keywords, tags, quick search;
  - **Advanced criteria** (field / operator / value) to use custom `cf_*` fields and change-history search;
  - **Raw REST parameters** (JSON) for any API parameter not covered above.
- **Ordering (`order by`)**: sort results by bug ID, importance (priority/severity), last change date (`delta_ts`) or creation date (`creation_ts`), ascending or descending.
- **Customizable popup**: set the maximum number of detected tickets displayed (up to 50, older ones are dropped); the list auto-scrolls to the most recent.
- **Two authentication modes**:
  - *Open tab session*: the request is made same-origin through a content script (no CORS issues) and your Bugzilla session is reused;
  - *API key*: the key (`api_key`) is sent in the request, without needing an open tab.
- **First-run baseline**: tickets already present at first start do not trigger alerts (configurable).
- **Status popup**: last poll, detection history, enable/disable toggle and a "Check now" button.

**Français**

- **Détection des nouveaux tickets** : l'extension interroge l'API REST (`GET /rest/bug`) selon la fréquence configurée et vous alerte uniquement pour les tickets qu'elle n'a jamais vus.
- **Alertes toast + son** : notification native (toast) et carillon généré (ou URL MP3/WAV/OGG personnalisée).
- **Critères entièrement paramétrables** :
  - Produit, composant, statut, sévérité, priorité, résolution, assigné à, créé par, résumé, version, milestone cible, OS, plateforme, QA contact, whiteboard, mots-clés, tags, recherche rapide ;
  - **Critères avancés** (champ / opérateur / valeur) pour utiliser les champs personnalisés `cf_*` et la recherche par historique ;
  - **Paramètres REST bruts** (JSON) pour tout paramètre de l'API non couvert ci-dessus.
- **Tri (`order by`)** : résultats classés par ID du ticket, importance (priorité/sévérité), date de changement (`delta_ts`) ou date de création (`creation_ts`), croissant ou décroissant.
- **Popup personnalisable** : nombre max de tickets détectés affichés (jusqu'à 50, les plus anciens étant ignorés) ; la liste défile automatiquement vers les plus récents.
- **Deux modes d'authentification** :
  - *Session d'un onglet ouvert* : la requête est faite en même origine via un script de contenu (aucun problème de CORS) et votre session Bugzilla est réutilisée ;
  - *Clé API* : la clé (`api_key`) est envoyée dans la requête, sans avoir besoin d'un onglet ouvert.
- **Baseline au premier lancement** : les tickets déjà présents au premier démarrage ne déclenchent pas d'alerte (configurable).
- **Popup de statut** : dernier poll, historique des détections, activation/désactivation et bouton « Vérifier maintenant ».

---

## Installation

### Temporary (development) / À la volée (développement)

**English**

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on** and select the `manifest.json` file.
3. At installation, grant the "Access your data for all websites" permission.

**Français**

1. Ouvrez `about:debugging#/runtime/this-firefox` dans Firefox.
2. Cliquez sur **Charger un module temporaire** et sélectionnez le fichier `manifest.json`.
3. À l'installation, accordez la permission « Accéder à vos données pour tous les sites ».

### Permanent / Installation permanente

**English**

1. Commit the folder's files to the repository; the extension uses **Manifest V2** (required for Firefox).
2. To distribute, package the files as a ZIP and submit them to [AMO](https://addons.mozilla.org/) for signing (the `gecko` ID is defined in `browser_specific_settings`).

**Français**

1. Commitez les fichiers du dossier dans le dépôt ; l'extension est en **Manifest V2** (obligatoire pour Firefox).
2. Pour distribuer, empaquetez les fichiers en ZIP et soumettez-les sur [AMO](https://addons.mozilla.org/) pour signature (l'ID `gecko` est défini dans `browser_specific_settings`).

---

## Configuration

**English**

1. Click the extension icon, then **Detection settings…**.
2. Enter the **instance URL** (e.g. `https://bug.ma-societe.fr`) — without `/rest`.
3. Choose the **authentication**:
   - **Open tab session**: log in to Bugzilla in a tab of this profile and keep it open;
   - **API key**: create a key in *Bugzilla profile → API Keys* and paste it.
4. Set the **polling frequency** (1 minute by default).
5. Filter with the **search criteria** (comma-separated values = OR; rows are combined with AND).
6. Tune the **notifications** (toast, sound, custom sound).
7. Click **Save**, then **Test search** to validate access.

Monitoring starts automatically. A badge on the icon shows the number of new detections since the last view.

**Français**

1. Cliquez sur l'icône de l'extension puis **Paramètres de détection…**.
2. Renseignez l'**URL de l'instance** (ex. `https://bug.ma-societe.fr`) — sans `/rest`.
3. Choisissez l'**authentification** :
   - **Session d'un onglet ouvert** : connectez-vous à Bugzilla dans un onglet de ce profil et laissez-le ouvert ;
   - **Clé API** : créez une clé dans *Profil Bugzilla → API Keys* et collez-la.
4. Définissez la **fréquence de polling** (1 minute par défaut).
5. Filtrez avec les **critères de recherche** (séparés par des virgules = OU ; les lignes sont combinées en ET).
6. Réglez les **notifications** (toast, son, son personnalisé).
7. Cliquez sur **Enregistrer**, puis **Tester la recherche** pour valider l'accès.

Le monitoring démarre automatiquement. Un badge sur l'icône affiche le nombre de nouvelles détections depuis la dernière consultation.

---

## Project structure / Structure du projet

**English**

```
bugzilla-watcher-plugin/
├── manifest.json          # Manifest V2, permissions, gecko ID
├── background.js          # Polling (alarms), detection, notifications, sound
├── contentScript.js       # Same-origin requests to /rest (session mode)
├── icons/                 # SVG icons
├── options/               # Settings page (criteria, auth, notifications)
└── popup/                 # Status and action popup
```

**Français**

```
bugzilla-watcher-plugin/
├── manifest.json          # Manifest V2, permissions, ID gecko
├── background.js          # Polling (alarms), détection, notifications, son
├── contentScript.js       # Requêtes même-origine vers /rest (mode session)
├── icons/                 # Icônes SVG
├── options/               # Page de configuration (critères, auth, notifications)
└── popup/                 # Popup de statut et d'actions
```

---

## How detection works / Déroulement de la détection

**English**

1. An alarm triggers a poll every N minutes.
2. The request `/rest/bug?…&creation_time=<last poll>` is sent (content script in session mode, background `fetch` otherwise).
3. The returned IDs are compared to the already-seen tickets (stored in `storage.local`).
4. For each new ticket: toast + sound, badge update and history update.

**Français**

1. Une alarme déclenche un poll toutes les N minutes.
2. La requête `/rest/bug?…&creation_time=<dernier poll>` est émise (script de contenu en mode session, `fetch` du background sinon).
3. Les IDs retournés sont comparés aux tickets déjà vus (stockés en `storage.local`).
4. Pour chaque nouveau ticket : toast + son, mise à jour du badge et de l'historique.

---

## Permissions used / Permissions utilisées

**English**

| Permission | Reason |
| --- | --- |
| `storage` | Persistence of settings and seen-IDs history |
| `alarms` | Periodic polling |
| `notifications` | Detection toast |
| `<all_urls>` | Content script injection and access to Bugzilla instances (required to bypass CORS) |

**Français**

| Permission | Raison |
| --- | --- |
| `storage` | Persistance des paramètres et de l'historique des IDs |
| `alarms` | Polling périodique |
| `notifications` | Toast de détection |
| `<all_urls>` | Injection du script de contenu et accès aux instances Bugzilla (obligatoire pour contourner le CORS) |

---

## Troubleshooting / Dépannage

**English**

- **CORS error**: use the *Open tab session* mode (same-origin requests). Make sure a logged-in Bugzilla tab is open. If your instance runs on a **non-standard port** (e.g. `:8080`), note that Firefox (bug 1362809) ignores ports in host permissions — rely on `http(s)://host/*` patterns.
- **"Access denied by Bugzilla"** (HTTP 401/403): log in again in a tab, or check your API key.
- **No alert on first start**: expected behavior (baseline). Uncheck "Do not alert on existing tickets at first launch" if you want to be notified about existing tickets.
- **Sound not audible**: the chime uses the background's Web Audio API; if you are remote, pick a custom sound URL.

**Français**

- **Erreur CORS** : utilisez le mode *Session d'un onglet ouvert* (requêtes même-origine). Vérifiez qu'un onglet Bugzilla connecté est ouvert. En cas d'instance sur un **port non standard** (ex. `:8080`), sachez que Firefox (bug 1362809) ignore les ports dans les permissions d'hôte — reportez-vous aux patterns `http(s)://host/*`.
- **« Accès refusé par Bugzilla »** (HTTP 401/403) : reconnectez-vous dans un onglet, ou vérifiez votre clé API.
- **Aucune alerte au premier lancement** : c'est le comportement normal (baseline). Décochez « Ne pas alerter sur les tickets existants au premier lancement » si vous voulez notifier l'existant.
- **Son non audible** : le carillon utilise l'API Web Audio du background ; si vous êtes à distance, choisissez une URL de son personnalisée.

---

## License / Licence

**English**

[GNU AGPL v3](LICENSE) — see the `LICENSE` file for details.

**Français**

[GNU AGPL v3](LICENSE) — voir le fichier `LICENSE` pour le détail.