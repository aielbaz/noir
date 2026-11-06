#!/usr/bin/env python3
"""Generates the demo catalogue (data.json) and its artwork (art/*.jpg).
Everything is invented: titles, people, plots and pictures. Nothing is taken from a real film or channel."""
import json, os, subprocess, random, textwrap, time

random.seed(7)
HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, 'art')
os.makedirs(ART, exist_ok=True)
FONT = 'DejaVu-Sans-Bold'

PALETTES = [
    ('#1b2a49', '#e4572e'), ('#0b3d2e', '#f2c14e'), ('#3a0ca3', '#f72585'), ('#14213d', '#fca311'),
    ('#2b2d42', '#ef233c'), ('#023047', '#8ecae6'), ('#3d1e6d', '#ff9f1c'), ('#1a1a2e', '#16c79a'),
    ('#432818', '#e9c46a'), ('#10002b', '#c77dff'), ('#0d1b2a', '#e0fbfc'), ('#4a0e2e', '#ffb703'),
]

FIRST = ['Maya', 'Idris', 'Lena', 'Tomas', 'Aiko', 'Rafael', 'Nora', 'Kofi', 'Elise', 'Dario', 'Samira', 'Jonas', 'Priya', 'Caleb', 'Yara', 'Felix']
LAST = ['Hartwell', 'Okafor', 'Lindqvist', 'Moreau', 'Tanaka', 'Valdez', 'Brennan', 'Haddad', 'Novak', 'Castellan', 'Rhodes', 'Ibarra', 'Sato', 'Whitlock']

def person(i): return f'{FIRST[i % len(FIRST)]} {LAST[(i * 5 + 3) % len(LAST)]}'
def people(i, n): return ', '.join(person(i * 3 + k * 7) for k in range(n))

def wrap(title, width):
    return '\n'.join(textwrap.wrap(title, width=width))

def run(*args): subprocess.run(args, check=True)

def poster(name, title, pal):
    a, b = pal
    out = os.path.join(ART, name)
    if os.path.exists(out): return
    run('magick', '-size', '600x900', f'gradient:{a}-{b}', '-rotate', '0',
        '(', '-size', '600x900', 'xc:none', '-fill', 'rgba(255,255,255,0.10)', '-draw', 'circle 430,300 430,60', ')', '-composite',
        '(', '-size', '600x900', 'xc:none', '-fill', 'rgba(0,0,0,0.28)', '-draw', 'rectangle 0,600 600,900', ')', '-composite',
        '-font', FONT, '-pointsize', '58', '-fill', 'white', '-gravity', 'southwest', '-annotate', '+44+90', wrap(title, 12),
        '-pointsize', '20', '-fill', 'rgba(255,255,255,0.7)', '-annotate', '+44+40', 'A NOIR DEMO ORIGINAL',
        '-quality', '82', out)

def backdrop(name, title, pal):
    a, b = pal
    out = os.path.join(ART, name)
    if os.path.exists(out): return
    run('magick', '-size', '1280x720', f'gradient:{b}-{a}', '-rotate', '90', '-resize', '1280x720!',
        '(', '-size', '1280x720', 'xc:none', '-fill', 'rgba(255,255,255,0.08)', '-draw', 'circle 960,260 960,20', ')', '-composite',
        '(', '-size', '1280x720', 'gradient:rgba(0,0,0,0.0)-rgba(0,0,0,0.55)', ')', '-composite',
        '-font', FONT, '-pointsize', '84', '-fill', 'rgba(255,255,255,0.9)', '-gravity', 'southwest', '-annotate', '+70+90', wrap(title, 22),
        '-quality', '80', out)

def logo(name, text, pal):
    a, b = pal
    out = os.path.join(ART, name)
    if os.path.exists(out): return
    run('magick', '-size', '256x256', f'gradient:{a}-{b}', '-font', FONT, '-pointsize', '40', '-fill', 'white',
        '-gravity', 'center', '-annotate', '+0+0', wrap(text, 8), '-quality', '85', out)

GENRES = ['Action', 'Drama', 'Thriller', 'Mystery', 'Adventure', 'Comedy', 'Family', 'Sci-Fi', 'Crime', 'Romance']
PLOTS = [
    'A retired pilot takes one last job and finds the cargo is not what she was promised.',
    'When a small coastal town loses power for a week, neighbours discover what they really owe each other.',
    'Two rival cartographers race across a continent to map a place that does not want to be found.',
    'A night-shift nurse notices the same stranger at every ward she covers, and begins to ask why.',
    'An engineer inherits her grandfather’s workshop and a machine nobody has ever seen switched on.',
    'A quiet courier is drawn into a chain of favours that stretches across a single, very long night.',
    'A family restores a failing lighthouse and uncovers the logbooks of everyone who kept it before them.',
    'In a city that never stops raining, an archivist starts erasing the wrong records.',
]

MOVIE_CATS = [
    ('101', 'Featured 2026', ['Midnight Harbor', 'The Last Lantern', 'Paper Skies', 'Velvet Static', 'Ash & Ember', 'North of Nowhere', 'Quiet Machines', 'Saltwater Hearts']),
    ('102', 'Action', ['Redline Protocol', 'Iron Meridian', 'Dust Runner', 'Black Tide', 'Hard Reset', 'Vector Zero']),
    ('103', 'Drama & Thriller', ['The Glass Garden', 'Winter Ledger', 'Echoes of Marlow', 'Small Hours', 'A Quiet Verdict', 'Harbor Lights']),
    ('104', 'Family', ['Pip and the Moon Train', 'Bramble Hollow', 'The Cloud Cartographer', 'Captain Biscuit']),
]
SERIES_CATS = [
    ('201', 'Drama Series', ['The Lighthouse Files', 'Copper Valley', 'Nightshift', 'Harrow & Finch', 'Seven Doors', 'Glass Harbor']),
    ('202', 'Comedy & Lifestyle', ['Orbit Street', 'The Understudies', 'Kitchen Table', 'Tidewater', 'Neon Parish', 'Far Meridian']),
]
LIVE_CATS = [
    ('301', 'News', ['Noir News 24', 'Noir World', 'Noir Business']),
    ('302', 'Sports', ['Noir Sports 1', 'Noir Sports 2', 'Noir Racing']),
    ('303', 'Entertainment', ['Noir Movies', 'Noir Classics', 'Noir Comedy', 'Noir Music']),
    ('304', 'Kids & Documentary', ['Noir Kids', 'Noir Nature', 'Noir Docs', 'Noir Cooking']),
]

now = int(time.time())
data = {'movie_cats': [], 'movies': [], 'series_cats': [], 'series': [], 'live_cats': [], 'live': []}
n = 0
for cid, cname, titles in MOVIE_CATS:
    data['movie_cats'].append({'category_id': cid, 'category_name': cname, 'parent_id': 0})
    for t in titles:
        n += 1
        pal = PALETTES[n % len(PALETTES)]
        slug = f'm{n}'
        poster(slug + '.jpg', t, pal); backdrop(slug + '_bd.jpg', t, pal)
        mins = random.choice([94, 101, 108, 112, 119, 126, 134])
        g = ' / '.join(random.sample(GENRES, 2))
        data['movies'].append({
            'num': n, 'name': t, 'stream_type': 'movie', 'stream_id': 1000 + n, 'stream_icon': f'@art/{slug}.jpg',
            'rating': f'{random.uniform(5.4, 8.8):.1f}', 'added': str(now - n * 86400), 'category_id': cid,
            'container_extension': 'mp4',
            '_info': {'plot': PLOTS[n % len(PLOTS)], 'genre': g, 'cast': people(n, 4), 'director': person(n * 11),
                      'year': '2026', 'mins': mins, 'bitrate': random.choice([3200, 4200, 5600]), 'backdrop': f'@art/{slug}_bd.jpg'},
        })

n = 0
for cid, cname, titles in SERIES_CATS:
    data['series_cats'].append({'category_id': cid, 'category_name': cname, 'parent_id': 0})
    for t in titles:
        n += 1
        pal = PALETTES[(n + 4) % len(PALETTES)]
        slug = f's{n}'
        poster(slug + '.jpg', t, pal); backdrop(slug + '_bd.jpg', t, pal)
        g = ' / '.join(random.sample(GENRES, 2))
        seasons = random.choice([1, 2, 3])
        data['series'].append({
            'num': n, 'name': t, 'series_id': 2000 + n, 'cover': f'@art/{slug}.jpg', 'plot': PLOTS[(n + 3) % len(PLOTS)],
            'cast': people(n + 20, 4), 'director': person(n * 13), 'genre': g, 'release_date': '2025-09-12', 'year': '2025',
            'last_modified': str(now - n * 3600), 'rating': f'{random.uniform(6.0, 9.1):.1f}', 'rating_5based': '4',
            'backdrop_path': [f'@art/{slug}_bd.jpg'], 'youtube_trailer': '', 'episode_run_time': '45', 'category_id': cid,
            '_seasons': seasons,
        })

n = 0
for cid, cname, names in LIVE_CATS:
    data['live_cats'].append({'category_id': cid, 'category_name': cname, 'parent_id': 0})
    for t in names:
        n += 1
        slug = f'l{n}'
        logo(slug + '.jpg', t.replace('Noir ', 'NOIR\n'), PALETTES[(n + 2) % len(PALETTES)])
        data['live'].append({'num': n, 'name': t, 'stream_type': 'live', 'stream_id': 3000 + n, 'stream_icon': f'@art/{slug}.jpg',
                             'epg_channel_id': f'noir.{n}', 'added': str(now - 1000000), 'category_id': cid, 'tv_archive': 0})

json.dump(data, open(os.path.join(HERE, 'data.json'), 'w'), ensure_ascii=False, indent=1)
print('movies', len(data['movies']), 'series', len(data['series']), 'live', len(data['live']), 'art files', len(os.listdir(ART)))
