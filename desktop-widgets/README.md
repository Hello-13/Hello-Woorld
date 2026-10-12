# Study Widgets

Your claude.ai **Dashboard** and **Academic Hub** as small windows on your desktop. Drag them anywhere, resize them, and pin them above your other windows. They're your real pages, signed in to your account, so the calendar, Gmail, saved progress and Claude-written targets all work like they do on claude.ai.

## Get it

1. On GitHub, open the repo's **Actions** tab and choose **Study Widgets app**.
2. Open the newest run with a green check. Under **Artifacts**, download the one for your computer:
   - **Study-Widgets-macOS**: a `.dmg`. Use `arm64` on an Apple Silicon Mac (M1 or newer), `x64` on an older Intel Mac.
   - **Study-Widgets-Windows**: a setup `.exe`.
   - **Study-Widgets-Linux**: an `.AppImage`.
3. Unzip the download and install:
   - **Mac:** open the `.dmg` and drag Study Widgets into Applications. The app isn't signed with an Apple developer account, so the first time you open it macOS refuses. Go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**. If macOS says the app "is damaged", run `xattr -cr "/Applications/Study Widgets.app"` in Terminal, then open it again.
   - **Windows:** run the setup file. If SmartScreen warns about an unknown publisher, click **More info → Run anyway**.
   - **Linux:** make the file executable (`chmod +x Study-Widgets-*.AppImage`) and run it.

## First launch

Two widgets open on the right side of your screen. Sign in to Claude inside either one. Both share the sign-in, and it stays signed in.

- **Sign in with your email**, using the code Claude sends you. Google's "Continue with Google" button often refuses to work inside desktop apps.
- When a page asks to use Google Calendar or Gmail, allow it, just as you did on claude.ai.

## Using the widgets

- **Move:** drag the strip at the top of a widget.
- **Resize:** drag any edge or corner.
- **Pin** (the pushpin button) keeps a widget above other windows. On a Mac it also follows you across desktops. Click it again to let the widget sit normally.
- **Zoom** with **−** and **+**, or Ctrl/Cmd and `-`, `=`, `0`. Zoom starts at 80% so the pages fit a narrow window. Both widgets are on claude.ai, so they share one zoom setting.
- **Reload** with the circular arrow or Ctrl/Cmd+R. If you click into another claude.ai page, a house button takes you back.
- **Hide** with **×**. The app keeps running. Bring a widget back from the Study Widgets icon in your menu bar (Mac) or system tray (Windows), or press **Alt+Shift+W** to show or hide them all.
- Links to other sites (Canvas, Bible Gateway, Gmail) open in your normal browser.
- Positions, sizes and pins are remembered between launches. If a widget ends up off screen, choose **Put widgets back in place** from the tray menu.
- **Open at login** in the tray menu starts the widgets when you turn on your computer.

## Add another page

Choose **Edit widget list…** from the tray menu. A file like this opens:

```json
{
  "widgets": [
    { "id": "dashboard", "name": "Paul's Dashboard", "url": "https://claude.ai/artifact/VcqFy2By7LXfXmDorGT9FA" },
    { "id": "hub", "name": "Academic Hub", "url": "https://claude.ai/artifact/UMknkvH5BzFV5C1NGveuoT" }
  ],
  "shortcut": "Alt+Shift+W",
  "openAtLogin": false
}
```

Add a line with a `name` and a `url` (any `https` page, such as your Chem Bench artifact) and save. The new widget appears right away. Removing a line closes that widget. `shortcut` takes Electron accelerator names, like `CommandOrControl+Shift+D`, or `""` for no shortcut.

## No-install option

Chrome and Edge can turn any page into its own window:

- **Chrome:** open the page, then **⋮ → Cast, save, and share → Install page as app** (or **Create shortcut…** with **Open as window** ticked).
- **Edge:** **⋯ → Apps → Install this site as an app**.
- **Safari (macOS Sonoma or later):** **File → Add to Dock**. You'll sign in to Claude again inside it.

These windows move and resize like any app, with their own Dock or taskbar icon. They can't float on top, hide to the tray, or remember a layout the way Study Widgets does.

## Run from source

```bash
cd desktop-widgets
npm install
npm start          # launches the widgets
npm test           # settings and layout tests
npm run smoke      # launches the real app against a local page and checks the title bar
npm run dist       # builds an installer for this computer into dist/
```

## How it's built

An [Electron](https://www.electronjs.org/) app. Each widget is a frameless window holding two views:

- a 34 px title bar (`src/toolbar.html`)
- your page, loaded into a separate, sandboxed browser view

The page gets no access to the app or your computer. It can stay on its own site and Claude's sign-in pages; anything else opens in your default browser. Sign-in cookies live in the app's own browser storage on your computer. Settings are in `widgets.json` and `state.json` in the app's data folder (open it from **Edit widget list…**).
