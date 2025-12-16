# Twitter API Setup Guide

Um echte Twitter-Posts in der AlphaHub anzuzeigen, müssen Sie einen Twitter API Bearer Token konfigurieren.

## Schritt 1: Twitter Developer Account erstellen

1. Gehen Sie zu [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Erstellen Sie ein Developer Account (falls noch nicht vorhanden)
3. Erstellen Sie eine neue App oder verwenden Sie eine bestehende

## Schritt 2: Bearer Token generieren

1. Gehen Sie zu Ihrer App im Developer Portal
2. Navigieren Sie zu "Keys and Tokens"
3. Generieren Sie einen "Bearer Token" (falls noch nicht vorhanden)
4. Kopieren Sie den Token

## Schritt 3: Token zu Cloudflare Workers hinzufügen

### Option A: Via Cloudflare Dashboard

1. Gehen Sie zu [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Wählen Sie Ihr Worker-Projekt aus
3. Gehen Sie zu "Settings" → "Variables and Secrets"
4. Fügen Sie eine neue Secret hinzu:
   - **Name**: `TWITTER_BEARER_TOKEN`
   - **Value**: Ihr Bearer Token

### Option B: Via Wrangler CLI

```bash
npx wrangler secret put TWITTER_BEARER_TOKEN
```

Geben Sie dann Ihren Bearer Token ein, wenn Sie dazu aufgefordert werden.

## Schritt 4: Für lokale Entwicklung

Fügen Sie den Token zu `.dev.vars` hinzu:

```env
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

## Wichtige Hinweise

- **Kostenloses Kontingent**: Twitter bietet 1.500 Tweets pro Monat kostenlos
- **Rate Limits**: Beachten Sie die Rate Limits der Twitter API
- **Fallback**: Falls kein Token konfiguriert ist, versucht das System RSS-Feeds zu verwenden (kann instabil sein)

## Alternative: RSS Feeds

Falls Sie keinen Twitter API Token haben, versucht das System automatisch, RSS-Feeds über alternative Dienste abzurufen. Dies ist jedoch nicht zuverlässig und kann jederzeit ausfallen.

