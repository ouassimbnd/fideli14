# Fideli V6 — MVP connecté à Supabase

Cette version sépare les comptes commerçants et clients. Le commerçant crée un établissement et un programme, le client rejoint le programme depuis `/join/[slug]`, reçoit un lien email et retrouve ses points dans `/customer`. Les visites, récompenses et avis privés sont enregistrés dans Supabase. Les cartes physiques ont chacune un QR unique (`/card/[token]`) et peuvent être déclarées perdues puis remplacées.

## Mise en place

1. Créer ou sélectionner un projet Supabase. Faire une sauvegarde avant toute migration d'une base existante.
2. Exécuter **tout** `supabase/schema.sql` dans SQL Editor. Ce script crée les tables, remplace toutes les anciennes politiques RLS sur ces huit tables et installe les fonctions métier. Vérifiez les éventuelles applications qui utilisaient les anciennes politiques avant la migration. Sur une base qui contient déjà des établissements, attribuer `owner_id` manuellement à un compte Auth vérifié après contrôle de l'identité ; les anciennes lignes sans propriétaire ne sont pas administrables.
3. Exécuter `supabase/checks.sql` : le contrôle doit afficher une notice de succès. Puis effectuer les tests d'isolation avec de vrais comptes distincts ; le contrôle structurel seul ne suffit pas.
4. Dans Supabase > Authentication, activer Email. Pour le lien magique, conserver un modèle d'email utilisant `{{ .ConfirmationURL }}`. Configurer `Site URL` sur l'URL du site et ajouter `https://votre-domaine/auth/callback*` dans la liste des Redirect URLs. Ajouter l'URL Preview uniquement si nécessaire. Configurer l'envoi SMTP adapté avant un usage réel.
5. Dans Vercel, preset **Next.js**, Root Directory `./`, ajouter :

| Nom | Valeur |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (publishable) Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role, **secrète et seulement côté serveur**, utilisée uniquement pour la suppression complète d'un compte |

6. Redéployer après toute modification de variable. Ne jamais mettre la clé service role dans une variable `NEXT_PUBLIC_`, un commit ou une capture d'écran.
7. Ouvrir `/business/login`, créer un compte, confirmer l'email, puis créer un commerce. Partager le lien `/join/son-slug` du tableau de bord.

Sans les deux variables publiques, les parcours connectés affichent « Configuration requise » ; l'accueil reste consultable. Sans la clé service role, la suppression complète est désactivée. Ne pas ouvrir les inscriptions clients avant d'avoir validé cette configuration et la politique de confidentialité.

## Vérifications avant ouverture

- Avec deux comptes commerçants A et B, vérifier que A ne peut lire ni modifier les clients, visites, cartes et récompenses de B, y compris via l'API Supabase.
- Avec deux comptes clients, vérifier qu'un client ne peut lire que ses adhésions et ne peut appeler `record_visit` ou `redeem_reward`.
- Scanner une carte vierge, l'associer à un client, enregistrer une visite avec le commerçant, déclarer la carte perdue et associer une nouvelle carte ; le QR perdu doit cesser de fonctionner.
- Vérifier l'email de confirmation et le lien magique en production, le QR et le bouton « Copier le lien » sur mobile.
- Tester la suppression du compte client, y compris ses visites et cartes liées. Compléter `/privacy` avec l'identité du responsable, son contact et les durées de conservation définies pour ce service.

Les appels `record_visit`, `redeem_reward`, `submit_feedback`, `claim_card` et `issue_card` sont vérifiés par l'identité Auth et les fonctions SQL. La clé publique est prévue pour le navigateur ; le contrôle d'accès repose sur RLS. Les cartes Wallet précédentes, qui faisaient confiance aux points transmis par le client, sont retirées du MVP connecté jusqu'à une émission et mise à jour vérifiées côté serveur.

## Analyses commerçant

`/business/analytics` affiche, pour le commerce connecté : la tendance des visites et nouvelles cartes sur 30 jours, le taux de clients fidélisés (2 visites ou plus), le taux de visites converties en récompense, les visites moyennes par client, le rythme par jour de semaine et le classement des 5 meilleurs clients. Tout est calculé côté base par `business_analytics` (dans `supabase/schema.sql`), protégé comme le reste par `owns_business`, donc à exécuter avec le reste du script SQL. Les graphiques sont en SVG natif, sans dépendance ajoutée.

## Apple Wallet

Le bouton « Ajouter à Apple Wallet » (page `/customer`) génère un vrai fichier `.pkpass` à la volée via `passkit-generator` (déjà dans `package.json`) et `app/api/wallet/[membership]/route.ts`. Le modèle visuel se trouve dans `wallet/fideli.pass/` (icône et logo fournis ; à remplacer par votre identité visuelle).

Pour l'activer, il faut un compte Apple Developer et un identifiant de pass (Pass Type ID) :

1. Créer un certificat **Pass Type ID** dans Apple Developer (Certificates, Identifiers & Profiles), associé à un identifiant du type `pass.com.votredomaine.fideli`.
2. Exporter le certificat signé et sa clé privée au format `.pem` (voir le guide « Generating Certificates » de `passkit-generator`), ainsi que le certificat WWDR d'Apple.
3. Encoder chaque fichier en base64 (`base64 -i fichier.pem`) et ajouter dans Vercel :

| Nom | Valeur |
| --- | --- |
| `APPLE_WALLET_SIGNER_CERT_BASE64` | Certificat signé, encodé en base64 |
| `APPLE_WALLET_SIGNER_KEY_BASE64` | Clé privée, encodée en base64 |
| `APPLE_WALLET_WWDR_BASE64` | Certificat WWDR Apple, encodé en base64 |
| `APPLE_WALLET_KEY_PASSPHRASE` | Phrase secrète de la clé, si définie (sinon, ne pas ajouter la variable) |
| `APPLE_WALLET_PASS_TYPE_IDENTIFIER` | Ex. `pass.com.votredomaine.fideli` |
| `APPLE_WALLET_TEAM_IDENTIFIER` | Identifiant d'équipe Apple Developer (10 caractères) |
| `NEXT_PUBLIC_SITE_URL` | URL du site en production, utilisée dans le QR code du pass |

Sans ces variables, le bouton affiche un message clair plutôt que d'échouer silencieusement. Le bouton Google Wallet est affiché mais désactivé : son intégration nécessite un compte Google Wallet API distinct et n'est pas incluse dans cette livraison.

## Cartes physiques et prix

Le tableau de bord crée un token UUID aléatoire lié à l'ID unique de l'établissement. La carte imprimée porte l'URL `/card/[token]`. Chaque QR est téléchargeable en SVG depuis le tableau de bord pour préparer le fichier fabricant. Pour fixer le tarif, demander des devis fournisseurs et calculer : **coût unitaire complet = fabrication + impression/QR + livraison + pertes/remplacements + préparation**, puis ajouter le temps de mise en place et la marge. Vérifier la quantité minimale de commande et les échantillons avant d'annoncer un prix. Les 19 € HT/mois sur l'accueil sont une **hypothèse de lancement**, sans paiement intégré.

## Limites connues

Le tableau de bord charge 25 clients par page avec des totaux calculés côté base. Les 20 dernières cartes physiques sont affichées ; prévoir un inventaire paginé pour une production à grand volume. Il n'y a pas de paiement intégré, de campagnes marketing automatisées, de témoignages inventés ni de synchronisation Google Wallet. La page de confidentialité est un modèle à compléter avec les informations réelles et la durée de conservation avant un lancement public. Cette livraison ne contient pas les identifiants de votre projet Supabase, le SQL n'a pas été exécuté sur votre base, et l'icône/logo du pass Apple Wallet sont des placeholders à remplacer par votre identité visuelle.
