# Microsoft Edge Add-ons Submission Notes

Use this file as the working copy for Partner Center fields.

## Package

- Upload package: `dist/teams-gif-favorite-extension-edge-0.1.2.zip`
- Manifest version: MV3
- Extension version: `0.1.2`
- Visibility: Public
- Markets: All markets
- Category: Productivity
- Mature content: No

## Public URLs

- Website URL: `https://github.com/fdsf53451001/teams-gif-favorite-extension`
- Support contact: `fdsf53451001@gmail.com`
- Privacy policy URL: `https://github.com/fdsf53451001/teams-gif-favorite-extension/blob/main/PRIVACY.md`

## Store Listing

### Extension Name

Teams GIF Favorites

### Short Description

Add a local GIF favorites panel to Microsoft Teams on the web.

### Description

Teams GIF Favorites adds a lightweight favorites workflow to Microsoft Teams on the web. When you hover over a GIF in a Teams chat, a star button appears so you can save or remove that GIF from your local favorites. The extension also adds a Favorites entry inside the Teams GIF picker, making it easier to find and reuse GIFs you commonly send.

Favorites are stored locally in your browser with Chrome/Edge extension storage. The extension does not run analytics, does not send your favorites to a developer server, and does not load remote JavaScript. It uses access to Teams pages to add the star buttons and picker panel, and it uses GIPHY/Tenor host access only to preview or fetch GIF media that you choose to save or insert.

This extension is intended for Microsoft Teams in the browser. It does not support the native Teams desktop application because browser extensions cannot inject into that app.

### Search Terms

Microsoft Teams, GIF, favorites, GIPHY, Tenor, productivity, chat

## Store Assets

- Extension logo: `store-assets/edge-logo-300.png`
- Small promotional tile: optional, not prepared
- Large promotional tile: optional, not prepared
- Screenshots: optional in the current Partner Center flow, but recommended if you want a more complete listing

## Privacy Page

### Single Purpose

The extension adds a local GIF favorites feature to Microsoft Teams on the web. It lets users save GIF URLs from Teams chats, view those saved GIFs in a custom Favorites panel inside the Teams GIF picker, and insert a selected saved GIF back into the message composer.

### Permission Justification

`storage`: Required to save and sync the user's GIF favorites list locally across Teams tabs in the same browser profile.

Host access for `teams.microsoft.com` and `teams.live.com`: Required so the content script can run only on Microsoft Teams web pages, add star buttons to GIF messages, and add the Favorites panel to the Teams GIF picker.

Host access for GIPHY and Tenor domains: Required to preview saved GIFs and fetch GIF media selected by the user for insertion into the Teams message composer.

### Remote Code

No. The extension does not load or execute remotely hosted code. All JavaScript is packaged with the extension.

### Data Usage

The extension stores GIF favorite metadata locally in the browser. This includes GIF URLs, preview URLs, dimensions, alt text when available, a generated local identifier, and a timestamp. The extension does not collect or transmit this data to a developer-operated server.

The extension reads GIF elements on Teams pages only to detect GIFs, show the star button, and save the selected GIF. It does not collect chat messages, contacts, account identifiers, passwords, payment information, health information, or location information.

## Certification Testing Notes

1. Install the extension package in Microsoft Edge.
2. Open `https://teams.microsoft.com/` or `https://teams.live.com/` and sign in.
3. Open a chat containing a GIF from Teams' GIF picker.
4. Hover over the GIF. A star button should appear in the top-right corner of the GIF container.
5. Click the star button to save the GIF as a favorite.
6. Open the Teams GIF picker, go to the GIFs area, and select the Favorites entry added by the extension.
7. Confirm the saved GIF appears in the Favorites grid.
8. Click the saved GIF. The extension attempts to insert it into the Teams message composer. If Teams blocks automatic insertion in the current build, the extension copies the GIF to the clipboard and displays a paste instruction.
9. Click the star button again on the original GIF to remove it from favorites.

Known limitation: browser extensions cannot run in the native Microsoft Teams desktop application. The extension is for Teams web only.
