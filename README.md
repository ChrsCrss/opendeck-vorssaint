# Vorssaint Keep Awake for OpenDeck

An [OpenDeck](https://github.com/nekename/OpenDeck) / Stream Deck plugin that toggles the **Keep Awake** mode of [Vorssaint](https://github.com/vorssaint/vorssaint-utils) with one key and shows whether it is currently on.

| State | Key |
| --- | --- |
| Keep Awake off | dark key, dimmed Vorssaint logo |
| Keep Awake on | orange key, white Vorssaint logo |

macOS only.

## How it works

Vorssaint has no URL scheme, AppleScript dictionary or CLI, so the plugin uses two things it does expose:

- **Toggle:** the plugin sends Vorssaint's global Keep Awake shortcut (default ⌃⌥⌘K) through System Events (`osascript`). Vorssaint then starts its last chosen session or ends the running one.
- **State:** while Keep Awake is active, Vorssaint holds the power assertion `Vorssaint: keep the Mac awake`. The plugin polls `pmset -g assertions` every 2 seconds and sets the key state from it. After a key press it re-checks after 0.3 s and 0.9 s so the icon flips quickly.

## Requirements

- macOS 12 or newer
- [OpenDeck](https://github.com/nekename/OpenDeck) with Node.js 20 or newer on the `PATH`
- Vorssaint running, with its Keep Awake shortcut enabled
- **Accessibility permission for OpenDeck** (System Settings → Privacy & Security → Accessibility). Without it the key shows an alert and the log says `osascript failed`.

## Install

```sh
git clone https://github.com/ChrsCrss/opendeck-vorssaint.git
cd opendeck-vorssaint/de.chrscrss.vorssaint-keepawake.sdPlugin
npm install --omit=dev
cp -R "$PWD" ~/Library/Application\ Support/opendeck/plugins/
```

Copy the folder instead of symlinking it: unless Developer mode is enabled in OpenDeck, its file server refuses files outside the plugins folder, so a symlinked plugin shows question-mark icons.

Restart OpenDeck, then drag **Keep Awake** from the **Vorssaint** category onto a key.

## Configure

Select the key in OpenDeck. The property inspector lets you set the modifiers and the key of the shortcut. It must match the Keep Awake shortcut in Vorssaint (default ⌃⌥⌘K). The setting is stored globally, so every Keep Awake key uses it.

## Limitations

- A session started by Vorssaint itself (app trigger, power, external display) also shows as on, because the assertion exists. Pressing the key then ends it and suppresses the automation until its conditions clear. That is Vorssaint's behaviour.
- The state is read from the power assertion, not from Vorssaint directly. If another app creates an assertion with the same name, the key shows on.
- The toggle only works while the shortcut is not captured by another app.

## Troubleshooting

- **Alert on key press:** Vorssaint is not running, the shortcut does not match, or OpenDeck lacks Accessibility permission. Check the log at `~/Library/Logs/opendeck/plugins/de.chrscrss.vorssaint-keepawake.sdPlugin.log`.
- **Icon never changes:** run `pmset -g assertions | grep Vorssaint` while Keep Awake is on. If nothing shows, Vorssaint's session is not active.
- **Plugin missing in OpenDeck:** restart OpenDeck and check that `npm install` created `node_modules/ws`.

## Layout

```
de.chrscrss.vorssaint-keepawake.sdPlugin/
├── manifest.json            action, states, icons
├── bin/plugin.js            plugin logic (Node, uses ws)
├── propertyInspector/       shortcut settings UI
├── imgs/                    plugin, category and on/off icons (SVG + PNG)
└── package.json             dependency: ws
```

## Status

Early version. The state detection is tested against a simulated OpenDeck server; the shortcut toggle and the property inspector have only been tried by hand.

This is an unofficial plugin and is not affiliated with Vorssaint or OpenDeck.

The Vorssaint logo used in the icons is © Vorssaint and reserved brand material under the [Vorssaint trademark notice](https://github.com/vorssaint/vorssaint-utils/blob/main/TRADEMARKS.md). It is not covered by this repository's license and is only used to identify the app this plugin controls.
