# Microsoft Edge Add-ons Submission Notes

Use this file as the working copy for Partner Center fields.

## Package

- Upload package: `dist/teams-media-favorites-edge-0.2.2.zip`
- Manifest version: MV3
- Extension version: `0.2.2`
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

Teams Media Favorites

### Short Description

Add a local image and GIF favorites panel to Microsoft Teams on the web.

### Description

Teams Media Favorites adds a lightweight favorites workflow to Microsoft Teams on the web. When you hover over an image or GIF in a Teams chat, a star button appears so you can save or remove that media item from your local favorites. The extension also adds a Favorites entry inside the Teams picker, making it easier to find and reuse images and GIFs you commonly send.

Favorites are stored with Chrome/Edge extension storage and can sync across devices through the browser's extension sync service when browser sync is enabled. To avoid broken previews when Teams media URLs expire, the extension may also keep compressed local copies of saved images and small Teams-hosted GIFs in browser local extension storage on the current device. The extension does not run analytics, does not send your favorites to a developer server, and does not load remote JavaScript. It uses access to Teams pages to add the star buttons and picker panel, and it uses Microsoft 365 media, GIPHY, and Tenor host access only to preview or fetch media that you choose to save or insert.

This extension is intended for Microsoft Teams in the browser. It does not support the native Teams desktop application because browser extensions cannot inject into that app.

### Search Terms

Microsoft Teams, image, GIF, favorites, GIPHY, Tenor, productivity, chat

## Store Assets

- Extension logo: `store-assets/edge-logo-300.png`
- Small promotional tile: optional, not prepared
- Large promotional tile: optional, not prepared
- Screenshots: optional in the current Partner Center flow, but recommended if you want a more complete listing

## Privacy Page

### Single Purpose

The extension adds a local image and GIF favorites feature to Microsoft Teams on the web. It lets users save image or GIF favorites from Teams chats, view those saved items in a custom Favorites panel inside the Teams picker, remove individual saved items or clear all saved items, and insert a selected saved item back into the message composer.

### Permission Justification

`storage`: Required to save the user's media favorites list, store local cached media copies on the current device, sync metadata across Teams tabs, and sync favorite metadata across devices through the browser's extension sync service when browser sync is enabled.

Host access for `teams.microsoft.com` and `teams.live.com`: Required so the content script can run only on Microsoft Teams web pages, add star buttons to image and GIF messages, and add the Favorites panel to the Teams picker.

Host access for GIPHY and Tenor domains: Required to preview saved GIFs and fetch GIF media selected by the user for insertion into the Teams message composer.

Host access for Skype, SharePoint Online, OneDrive, and Office attachment domains: Required to preview saved Teams-hosted images and fetch image media selected by the user for insertion into the Teams message composer.

### Remote Code

No. The extension does not load or execute remotely hosted code. All JavaScript is packaged with the extension.

### Data Usage

The extension stores image and GIF favorite metadata in browser extension storage. This includes media URLs, preview URLs, dimensions, media type, alt text when available, a generated local identifier, and a timestamp. When browser sync is enabled, the browser may sync this metadata across the user's signed-in devices. The extension may also store compressed image previews and small Teams-hosted GIF copies in local browser extension storage on the current device so saved items remain available when temporary Teams URLs expire. The extension does not collect or transmit this data to a developer-operated server.

The extension reads image and GIF elements on Teams pages only to detect supported media, show the star button, and save the selected item. It does not collect chat messages, contacts, account identifiers, passwords, payment information, health information, or location information.

## Certification Testing Notes

1. Install the extension package in Microsoft Edge.
2. Open `https://teams.microsoft.com/` or `https://teams.live.com/` and sign in.
3. Open a chat containing an image or a GIF from Teams.
4. Hover over the image or GIF. A star button should appear in the top-right corner of the media container.
5. Click the star button to save the media item as a favorite.
6. Open the Teams GIF picker, go to the GIFs area, and select the Favorites entry added by the extension.
7. Confirm the saved image or GIF appears in the Favorites grid.
8. Click the saved item. The extension attempts to insert it into the Teams message composer. If Teams blocks automatic insertion in the current build, the extension copies the media item to the clipboard and displays a paste instruction.
9. Click the star button again on the original image or GIF to remove it from favorites.

Known limitation: browser extensions cannot run in the native Microsoft Teams desktop application. The extension is for Teams web only.
