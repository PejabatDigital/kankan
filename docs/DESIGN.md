# KanKan Design System

Agreed 2026-11-17. Mockups: `docs/mockups/` (`home-light.png`, `show-light.png`, `watch-light.png`).

## Feel
Plain, bright, white. No brand colour: the YouTube thumbnails provide all the colour. Grown-up, never cartoonish.

## Colours
| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | page background |
| `--text` | `#111111` | headings, main text, primary buttons, progress fill |
| `--muted` | `#6E6E73` | secondary text, inactive nav, back links |
| `--faint` | `#A1A1A6` | episode numbers |
| `--line` | `#E8E8EB` | header border, outlines |
| `--divider` | `#EFEFF1` | lines between episodes |
| `--surface` | `#F5F5F7` | highlighted row (episode in progress) |
| `--track` | `#E2E2E6` | progress bar track, "stack" edge on show cards |

Only light theme. (A dark version was mocked up and not chosen.)

## Type
- Font: system font stack: `-apple-system, "SF Pro Text", "Helvetica Neue", Arial, "PingFang SC", sans-serif`. No web fonts.
- Logo: **KanKan** 25px bold (letter-spacing -0.03em) + 看看 21px regular in `--muted`.
- Big title (banner): 52–56px bold, letter-spacing -0.035em.
- Watch title: 30px bold.
- Row heading: 21px semibold.
- Card title: 15px semibold. Episode title: 17px semibold.
- Meta text: 13px `--muted`.
- Small label (e.g. "SHOW · 70 EPISODES"): 13px semibold, uppercase, letter-spacing 0.08em, `--muted`.

## Shape and spacing
- Page side padding: 48px (desktop).
- Corners: banner 18px, cards 12px, small thumbnails 8–10px, buttons fully round (pill).
- Card gap: 20px. Space between rows: 44px.
- All thumbnails are 16:9, cropped to fill.

## Components
- **Header:** logo left, nav centre (Home · Shows · Videos), "Parents" pill with a lock icon right. 1px bottom border.
- **Home banner:** full-width picture with a dark fade from the left, white text and buttons on top.
- **Show banner:** split. Text left on white, picture right.
- **Buttons:** Primary = black pill, white text, play icon. Secondary = outlined pill (on white) or frosted white pill (on a picture).
- **Card (video):** thumbnail, title, meta line.
- **Card (show):** like a video card, plus a grey "stack" edge peeking above it to show it's a set of episodes.
- **Continue Watching card:** thumbnail, then a 4px progress bar under it (black fill on grey track), then title and "X min left".
- **Episode row:** number · thumbnail · title, episode and length. "Watched" pill when done. In-progress row gets a grey background and a progress bar.
- **Watch screen:** big YouTube player left. Right column: "Next episode" card with a black "Play next" button, then a "Coming up" list. Under the player: "Can't play here? Watch on YouTube" link.
- **Back link:** chevron plus the name of where you came from.

- **Chip:** pill button, 40px tall, 1px `#D9D9DE` border, white. Selected = black fill, white text. Used for tags in Parents and the age switcher on Home. An age chip shows its range in muted text ("Preschool 3–5").
- **Age switcher (Home):** a row of chips under the header (All, then the four age groups). Scrolls sideways on phone.
- **Cover picker (Parents):** a sideways strip of episode thumbnails; the chosen one has a 3px black outline.
- **Tag status:** an item with no age group shows a small "Not sorted yet" pill (amber `#FFF4D6` / `#8A5A00`), the only non-grey colour besides thumbnails and error red `#B42318`.

## Phone and iPad (proposed, not yet mocked up)
- Side padding drops to 16px on phone.
- Rows scroll sideways with a swipe. Cards about 70% of screen width on phone.
- Show banner stacks: picture on top, text below.
- Watch screen: player full width on top, next episode and coming up below it.
- Nav collapses to a simple bottom or top bar (to decide).
- Tap targets at least 44px.
