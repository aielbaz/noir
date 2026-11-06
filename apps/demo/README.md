# Noir demo server

A free, always-on Xtream Codes compatible server for the LG store reviewers, built as a Cloudflare Worker.
The catalogue is invented (24 movies, 12 series, 14 live channels): every title, person, plot and picture is made up.

- **Login:** server `https://demo.aielbaz.com`, user `demo`, password `demo`.
- **No hosted video.** Stream URLs redirect to public files:
  - Movies and episodes: the Sintel trailer and Big Buck Bunny (Blender Foundation, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)), from `download.blender.org` and the Internet Archive.
  - Live channels: public HLS test streams from Mux and Apple.
- **Cost:** none. The artwork is Workers static assets and the API is a few thousand requests a day at most, well inside the free plan.

```
pnpm demo           # run locally on http://localhost:8787 (from the repo root)
pnpm demo:deploy    # deploy with wrangler
python3 gen.py      # regenerate src/data.json and public/art (needs ImageMagick)
```

To deploy under another name, change `routes` in `wrangler.jsonc`. Remove it to use the free `*.workers.dev` address.
`demo.aielbaz.com` works on a free certificate because it is one level below `aielbaz.com`.
