# Privacy Policy

**Bugzilla Ticket Monitor** — Effective date: September 23, 2026

This policy explains what data the extension collects, stores, and transmits. It is kept intentionally short.

## In short

- No data is collected by the developers.
- No data is sent to the developers, to Mozilla, or to any advertising or analytics service.
- The extension only talks to a Bugzilla server that **you** configure.

## What the extension does

Bugzilla Ticket Monitor periodically queries the REST API of a Bugzilla instance you configure in the options page. It alerts you when new or modified bug tickets match your criteria.

## Data you provide

All settings live in your browser's `browser.storage.local` and never leave your device except as described below:

- **Bugzilla server URL** and **search criteria** — sent to the Bugzilla server you configured, as the query of an API request. This is required for the extension to function.
- **API key** (optional) — appended to requests only when you select "API key" authentication. It is sent only to the Bugzilla server you configured and is never transmitted anywhere else.
- **Session-based authentication** (optional) — requests are issued from your existing browser session on the Bugzilla site you are already signed in to. The extension does not read or store the site's cookies.

## Data received from Bugzilla

Bug summaries, IDs, and severity labels returned by your Bugzilla server are displayed and may be kept locally (last detection history, "already seen" ticket list) to avoid duplicate alerts. This data is stored in `browser.storage.local` and is removed when you uninstall the extension.

## Custom sound URL (optional)

If you set a custom notification sound URL, your browser loads that file directly. No file content is processed or stored by the extension.

## Third parties

The extension contains no third-party code, tracking, analytics, or advertising. The only network traffic is to the Bugzilla server you configured.

## Data removal

Uninstalling the extension deletes all data it stored locally. Data that exists on your Bugzilla server is subject to that server's own policies.

## Contact

For questions about this policy: support via the extension's store listing.