# Noir: UX scenario for LG testers

App id: `com.aielbaz.noir` · Version 1.0.0 · Resolution 1920×1080

Noir is a player. It has no content of its own and needs an Xtream Codes login.

**Test login for reviewers**
- Server: https://demo.aielbaz.com
- Username: demo
- Password: demo

The demo catalogue is invented. Movies and episodes play open-licensed sample clips (Sintel trailer and Big Buck Bunny, © Blender Foundation, CC BY 3.0); live channels play public test streams. The titles and videos do not match, as this is a demo.

## How to use the app

1. **Sign in.** On the login screen, move to the server address field with the arrow keys and press OK. The LG virtual keyboard opens; type the address, then press Enter to close it. Repeat for username and password, move to Sign in and press OK.
2. **Home.** The top banner rotates through new titles. Press OK on Watch now to open one. Move Down to Continue watching and the category rows; move Left or Right inside a row.
3. **Menu.** Press Left from the page to open the rail: Home, Live TV, Movies, TV Shows, My list. Settings is the gear icon at the bottom left. Back closes the rail.
4. **Movies / TV Shows / Live TV.** Pick a category on the left, then a title. Sort and search are at the top of the page. Hold OK on a title to add it to My list.
5. **Play a title.** On the details page press Play. During playback: OK or Play/Pause pauses. Left and Right skip 10 seconds (hold to go faster). Up selects the progress bar and Down reaches the buttons: back 10 s, play/pause, forward 10 s, speed, and audio and subtitles. On live TV, CH+ and CH- change channel.
6. **Series.** Choose a season, then an episode. Finished episodes show a check mark. Settings can turn on Autoplay next episode.
7. **Settings.** Shows the account, playback options, the Home banner and Home lists categories, default order and the watched badge. Sign out is at the bottom (press OK twice).
8. **Magic Remote.** Every control can also be clicked with the pointer. Hovering highlights a control, and the wheel scrolls pages and lists.
9. **Back and exit.** Back goes to the previous screen. On the first screen Back asks to confirm exit.

## Notes for testers

- The first open of a large list may take a few seconds while the list downloads; later opens are instant.
- Video plays over HLS or direct MP4/MKV depending on the provider.
- Subtitles embedded inside MKV files can't be shown on this TV; audio track switching works.
