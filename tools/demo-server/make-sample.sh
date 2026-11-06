#!/bin/sh
# Makes the short original sample video that every demo movie and episode plays (needs ffmpeg).
set -e
cd "$(dirname "$0")"
mkdir -p media
FONT=$(fc-match -f '%{file}' 'DejaVu Sans:bold')
ffmpeg -y -loglevel error \
  -f lavfi -i "gradients=s=1280x720:d=90:r=24:speed=0.015:c0=0x1b2a49:c1=0xe4572e:c2=0x3a0ca3:c3=0x0b3d2e:nb_colors=4" \
  -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 90 \
  -vf "drawtext=fontfile=$FONT:text='NOIR DEMO':fontcolor=white@0.9:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2-30,drawtext=fontfile=$FONT:text='An original sample video':fontcolor=white@0.6:fontsize=32:x=(w-text_w)/2:y=(h/2)+60" \
  -c:v libx264 -preset veryfast -b:v 1400k -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart media/sample.mp4
