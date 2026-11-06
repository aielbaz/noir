# Noir demo server

A tiny Xtream Codes compatible server with an invented catalogue (24 movies, 12 series, 14 live channels), used for the store screenshots and as a login for LG's reviewers. Every title, person, plot and picture is made up; nothing comes from a real film or channel.

```
python3 gen.py        # artwork + data.json (needs ImageMagick)
./make-sample.sh      # the 90 second sample video every movie and episode plays (needs ffmpeg)
node server.mjs 8089  # login: http://<this machine>:8089, user demo, password demo
```

- Movies and episodes play `media/sample.mp4` (an original clip, served with Range support).
- Live channels redirect to public HLS test streams (Mux and Apple), so they need internet access.
- To use it for review, run it on a public host (HTTP or HTTPS) and put that address in `assets/store/ux-scenario.md`.
