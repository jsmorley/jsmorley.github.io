# JSMorley Homepage

A buildless, static recreation of https://jsmorley.github.io/index.htm. The original ten pages, image tiles, order, text-only Rainmeter link groups, and back image are included. Desktop tiles retain the original 200 × 178 pixel cells, 15 pixel gaps, black background, and 125 pixel images. Small screens use a two-column layout.

## Run on your PC

Keep Pageant running with your GitHub key loaded. Double-click `start-local.cmd`, then open http://localhost:5000/editor.html. Keep the helper window open while using the editor. Python 3, Git, and PuTTY are already installed on this PC. The helper serves only the site files on the loopback interface and uses Pageant for GitHub SSH authentication.

The default view is read-only. Open http://localhost:5000/editor.html to enable editing in that PC browser. Bookmark this editor address. Once enabled, editing stays enabled in that browser until you select **Read-only view**, which opens https://jsmorley.github.io/index.htm (keeping the current folder). Reopening the local editor restores your unpublished draft.

After you open the editor once, that browser remembers it is your editing device. In read-only view, a small **Edit** button appears in the upper right and opens http://localhost:5000/editor.html. Other browsers and devices do not show this button until you explicitly open the editor there. Browser preferences are specific to each address: on the published site, open https://jsmorley.github.io/editor.html once on your PC to enable its button. Clearing browser site data also clears this preference.

## Edit

- Click **…** on a tile to change its title, URL, or image, or delete it. Drag an image into the panel or use the file picker. Uploaded images are embedded in your data, so no separate image upload is needed. Existing folder tiles open their folder; use **Folders** to edit page properties.
- **Add link** adds an item to the page you are viewing.
- **Organize** enables drag handles. Drag a handle over another tile to move it to that position. Arrow buttons also reorder items with mouse or keyboard. Select **Done organizing** when finished. The back tile stays first.
- **Folders** creates a folder on the current page, sets its page name (browser tab title) and tile title, or edits/deletes existing folders. Nested folders return to their parent using the original back image. Deleting a page removes its contents and links pointing to it; child pages remain accessible in Folders and can be linked again using Edit.
- **Backup** downloads a JSON copy including uploaded images. **Import backup** restores it. Keep backups before large changes.

Changes save in this browser's IndexedDB, with localStorage as a fallback. Browser storage is specific to the browser and address. Clearing site data or using private browsing can remove drafts. Files and data use relative paths and work on GitHub Pages, including project subpaths. Modern Chrome, Edge, Firefox, and Safari are supported; viewing works on desktop, phone, and tablet. No service worker is used, so there is no app cache to maintain.

## Publish to jsmorley.github.io

### Publish directly from the editor

In the local PC editor, select **Publish to GitHub**, optionally adjust the commit message, and select **Commit and publish**. No token is required. The helper commits only `site-data.js` to `master`, including all your edited entries and embedded uploaded images, and pushes over SSH using Pageant. GitHub Pages then deploys the change. The helper checks for newer published bookmarks and refuses to overwrite them; it never force-pushes. If a push is interrupted after the commit, retrying pushes the existing commit.

The helper maintains its own checkout under `.publisher/repository` and refreshes published data when started. Do not edit this checkout manually. It uses `C:\Program Files\PuTTY\plink.exe -batch` and the existing Pageant key. Keep Pageant running. The hosted editor directs you to the PC editor for publishing. Your draft belongs to the browser and address where you edited it; use Backup and Import backup to move an unpublished draft between the hosted and local editors if needed.

### Initial deployment

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

`index.html` is the normal GitHub Pages entry point; `index.htm` and the original folder addresses also work. New folders use URL fragments and do not require new HTML files. The repository also includes `start-local.cmd`, `tools/local_server.py`, and its tests so the PC helper can be restored from Git. GitHub Pages uses only the static site files. Keep `reference/`, backups, `.publisher/`, and `.deployment/` local; they are not part of the published site.

After editing on your PC, select **Publish to GitHub → Commit and publish**. Use **Deployment status** to check when GitHub Pages finishes deploying, then refresh the site on your devices. Everything is read-only there by default.

GitHub Pages serves static files. Publishing runs only through the PC helper, which accepts same-origin requests with a per-run CSRF value; it does not accept requests from the hosted site or other websites. Backup and Import backup preserve and restore a JSON copy of your bookmarks. Editor mode is a browser preference, not authentication; anyone can open their own local editor, but they cannot change your published site without repository access. Published bookmarks and uploaded images are public.

When the published data changes, the editor starts from that version rather than applying a draft based on an older published version. Export a backup first if you want to preserve such a draft. Continue editing from a single PC browser/tab at a time.

## Original import

`reference/` contains the source HTML copied from your public site. `tools/import_original.py` reimports the originals and downloads their assets, replacing `seed.js` and the matching files in `Images/`. It leaves `site-data.js` intact. It is not needed to run the website.
