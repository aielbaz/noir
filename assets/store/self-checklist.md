# Noir: self-checklist working copy

Based on LG's App Self Checklist page. LG's own downloadable checklist is the one you must submit; use this as your notes while filling it in. Items marked **verify** or **not met** must be resolved or answered honestly (LG warns that inaccurate N/A or PASS entries can cause rejection).

## Mandatory UX

| Item | Status | Notes |
|---|---|---|
| 4-way keys, OK and Back control every selectable UI | PASS | Tested on the TV |
| Screen cursor (Magic Remote pointer) + OK on every selectable UI | PASS | Clicking confirmed by owner; hover highlight added in 1.0.1 |
| Back on the entry page shows the TV Home screen (webOS 23–25) | **verify** | App shows an "Exit Noir?" dialog first; may need to exit directly |
| Selection effect on every object | PASS | Ring and lift on keyboard focus and on pointer hover |

## Recommended UX

| Item | Status | Notes |
|---|---|---|
| 1920×1080 resolution | PASS | `resolution: 1920x1080` in appinfo.json |
| Buttons at least 75×75 px (1080p) | **not met** | Nav items are about 60 px tall |
| Text at least 20 px (1080p) | **not met** | Small text such as ratings and hints is about 17 px |
| Distinguishable states on buttons, menus, tabs | PASS | |
| Loading feedback | **verify** | Lists use skeletons; confirm a spinner while a stream starts |
| Magic Remote wheel scrolls lists | PASS | Page and list scrolling work |
| LG virtual keyboard on login fields | **verify** | Check the keyboard opens and closes cleanly on all three fields |
| Playback: on-screen menu, 4-way and pointer control | PASS | |
| Play/Pause buttons toggle or have one function each | **verify** | |

## Privacy and credentials

| Item | Status | Notes |
|---|---|---|
| No hard-coded passwords, tokens or keys in source | PASS | None in source |
| No credential keywords in file names | PASS | |
| Sensitive values in secure storage or encrypted | **not met** | Login is stored unencrypted in the app's localStorage |

## Content

| Item | Status | Notes |
|---|---|---|
| No inappropriate content | **depends on provider** | App ships no content; content comes from the user's provider. Reviewer should use the demo login |
| No gambling mechanics | PASS | None |

## Before submitting

- [ ] Resolve the three "not met" / "verify" items above, or answer them honestly
- [ ] Demo login in `ux-scenario.md` filled in and working
- [ ] Screenshots replaced with demo-content screenshots
- [ ] Support email added to `description.md` and `privacy-policy.md`
- [ ] Privacy policy published at the URL
- [ ] Upload the IPK, the 400×400 icon, the UX scenario and the completed LG checklist in Seller Lounge
