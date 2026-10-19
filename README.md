# JSMorley Homepage

A buildless, static recreation of https://jsmorley.github.io/index.htm. The original ten pages, image tiles, order, text-only Rainmeter link groups, and back image are included. Desktop tiles retain the original 200 × 178 pixel cells, 15 pixel gaps, black background, and 125 pixel images. Small screens use a two-column layout.

## Run on your PC

Double-click `start-local.cmd`, then open http://localhost:4000. Keep the server window open while using the site. Python 3 is already installed on this PC. You can also open `index.html` directly; using the local server gives browser storage a consistent address.

The default view is read-only. Open http://localhost:4000/editor.html to enable editing in that PC browser. Bookmark this editor address. Once enabled, editing stays enabled in that browser until you select **Read-only view**. Read-only view shows the published data; reopening the editor restores your unpublished draft.

After you open the editor once, that browser remembers it is your editing device. In read-only view, a small **Edit** button appears in the upper right and opens `editor.html`. Other browsers and devices do not show this button until you explicitly open the editor there. Browser preferences are specific to each address: on the published site, open https://jsmorley.github.io/editor.html once on your PC to enable its button. Clearing browser site data also clears this preference.

## Edit

- Click **…** on a tile to change its title, URL, or image, or delete it. Drag an image into the panel or use the file picker. Uploaded images are embedded in your data, so no separate image upload is needed. Existing folder tiles open their folder; use **Folders** to edit page properties.
- **Add link** adds an item to the page you are viewing.
- **Organize** enables drag handles. Drag a handle over another tile to move it to that position. Arrow buttons also reorder items with mouse or keyboard. Select **Done organizing** when finished. The back tile stays first.
- **Folders** creates a folder on the current page, sets its page name (browser tab title) and tile title, or edits/deletes existing folders. Nested folders return to their parent using the original back image. Deleting a page removes its contents and links pointing to it; child pages remain accessible in Folders and can be linked again using Edit.
- **Backup** downloads a JSON copy including uploaded images. **Import backup** restores it. Keep backups before large changes.

Changes save in this browser's IndexedDB, with localStorage as a fallback. Browser storage is specific to the browser and address. Clearing site data or using private browsing can remove drafts. Files and data use relative paths and work on GitHub Pages, including project subpaths. Modern Chrome, Edge, Firefox, and Safari are supported; viewing works on desktop, phone, and tablet. No service worker is used, so there is no app cache to maintain.

## Publish to jsmorley.github.io

### Publish directly from the editor

Select **Publish to GitHub**, enter your token, and select **Commit and publish**. This commits only `site-data.js` to `master`, including all your edited entries and embedded uploaded images. GitHub Pages then deploys the change. The panel checks for newer published bookmarks and refuses to overwrite them. The token is kept only in this tab's memory, never in browser storage, exported files, or the repository; reloading or choosing Read-only view clears it.

Create a token at https://github.com/settings/personal-access-tokens/new. Set the resource owner to `jsmorley`, choose **Only select repositories → jsmorley.github.io**, and grant **Contents → Read and write** under repository permissions. Choose an expiration date, generate the token, and copy it securely. Enter it in the Publish panel, not in chat. No account or workflow permissions are needed for this feature.

### Initial deployment or manual export

For the first deployment, copy these files and directories into the root of your `jsmorley.github.io` repository and commit/push them:

```
index.html
index.htm
editor.html
app.css
app.js
publisher.js
seed.js
site-data.js
favicon.ico
.nojekyll
Images/
Google.htm
RainmeterFolder.htm
NewsFolder.htm
VideoFolder.htm
DownloadsFolder.htm
NationalsFolder.htm
CommandersFolder.htm
PicturesFolder.htm
UZAFolder.htm
```

`index.html` is the normal GitHub Pages entry point; `index.htm` and the original folder addresses also work. New folders use URL fragments and do not require new HTML files. `reference/` and `tools/` are source/import aids; do not publish them. `start-local.cmd`, this README, and tests do not need to be deployed.

After editing on your PC:

1. Click **Export for GitHub**. Your browser downloads `site-data.js` containing all pages, links, order, and uploaded images.
2. Replace `site-data.js` in your repository with that downloaded file and commit/push it. If you maintain a local repository, replace the local file before committing. Do not overwrite the downloaded file with the old file from this project.
3. Wait for the GitHub Pages deployment to finish, then reload the site on your devices. Everything is read-only there by default. A cached tab may need a refresh.

GitHub Pages serves static files. The editor's publishing feature uses the GitHub API and your repository-scoped token to create a commit. Manual export remains available without a token. Editor mode is a browser preference, not authentication; anyone can open their own local editor, but they cannot change your published site without repository access. Published bookmarks and uploaded images are public.

When the published data changes, the editor starts from that version rather than applying a draft based on an older published version. Export a backup first if you want to preserve such a draft. Continue editing from a single PC browser/tab at a time.

## Original import

`reference/` contains the source HTML copied from your public site. `tools/import_original.py` reimports the originals and downloads their assets, replacing `seed.js` and the matching files in `Images/`. It leaves `site-data.js` intact. It is not needed to run the website.
