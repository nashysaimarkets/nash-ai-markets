#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:?output directory required}"
FONT_BOLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
mkdir -p "$OUTPUT_DIR"

render_video() {
  local size="$1"
  local output="$2"
  local width="${size%x*}"
  local height="${size#*x}"
  local title_size body_size small_size centre_y card_x card_w

  if [[ "$width" -gt "$height" ]]; then
    title_size=74; body_size=38; small_size=22; centre_y=390; card_x=250; card_w=1420
  else
    title_size=78; body_size=42; small_size=24; centre_y=650; card_x=80; card_w=920
  fi

  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "color=c=#030807:s=${size}:r=30:d=34" \
    -f lavfi -i "sine=frequency=110:sample_rate=48000:duration=34" \
    -vf "
      drawbox=x=0:y=0:w=iw:h=ih:color=#030807:t=fill,
      drawgrid=w=80:h=80:t=1:c=#28f6a70d,
      drawbox=x='mod(t*180,iw+500)-500':y=0:w=500:h=ih:color=#28f6a70b:t=fill,
      drawtext=fontfile=${FONT_BOLD}:text='THE MARKET NEVER STOPS':fontcolor=white:fontsize=${title_size}:x=(w-text_w)/2:y=${centre_y}:enable='between(t,0.4,3.7)',
      drawtext=fontfile=${FONT_REGULAR}:text='Noise. Headlines. Conflicting signals.':fontcolor=#9aa9a3:fontsize=${body_size}:x=(w-text_w)/2:y=${centre_y}+115:enable='between(t,1.0,3.7)',
      drawtext=fontfile=${FONT_BOLD}:text='MORE DATA IS NOT A DECISION PLAN':fontcolor=white:fontsize=${title_size}:x=(w-text_w)/2:y=${centre_y}:enable='between(t,4.0,7.4)',
      drawtext=fontfile=${FONT_REGULAR}:text='Structure the session before risking capital.':fontcolor=#28f6a7:fontsize=${body_size}:x=(w-text_w)/2:y=${centre_y}+115:enable='between(t,4.7,7.4)',
      drawbox=x=${card_x}:y=${centre_y}-180:w=${card_w}:h=430:color=#07110fee:t=fill:enable='between(t,7.8,13.6)',
      drawbox=x=${card_x}:y=${centre_y}-180:w=8:h=430:color=#28f6a7:t=fill:enable='between(t,7.8,13.6)',
      drawtext=fontfile=${FONT_BOLD}:text='NASH AI MARKETS':fontcolor=#28f6a7:fontsize=${title_size}:x=(w-text_w)/2:y=${centre_y}-85:enable='between(t,7.8,13.6)',
      drawtext=fontfile=${FONT_BOLD}:text='PROJECT BULLSEYE':fontcolor=white:fontsize=${title_size}:x=(w-text_w)/2:y=${centre_y}+15:enable='between(t,8.3,13.6)',
      drawtext=fontfile=${FONT_REGULAR}:text='A risk-first market preparation workspace':fontcolor=#9aa9a3:fontsize=${body_size}:x=(w-text_w)/2:y=${centre_y}+125:enable='between(t,9.0,13.6)',
      drawbox=x=${card_x}:y=${centre_y}-260:w=${card_w}:h=590:color=#07110fee:t=fill:enable='between(t,14.0,21.5)',
      drawtext=fontfile=${FONT_BOLD}:text='YOUR DAILY COMMAND CENTRE':fontcolor=white:fontsize=${title_size}:x=(w-text_w)/2:y=${centre_y}-190:enable='between(t,14.0,21.5)',
      drawtext=fontfile=${FONT_REGULAR}:text='OFFICIAL MACRO CONTEXT':fontcolor=#28f6a7:fontsize=${body_size}:x=(w-text_w)/2:y=${centre_y}-35:enable='between(t,14.7,21.5)',
      drawtext=fontfile=${FONT_REGULAR}:text='MY LEVELS   •   SESSION CHECKLIST':fontcolor=white:fontsize=${body_size}:x=(w-text_w)/2:y=${centre_y}+55:enable='between(t,15.5,21.5)',
      drawtext=fontfile=${FONT_REGULAR}:text='JOURNAL   •   RISK DISCIPLINE':fontcolor=white:fontsize=${body_size}:x=(w-text_w)/2:y=${centre_y}+145:enable='between(t,16.3,21.5)',
      drawtext=fontfile=${FONT_REGULAR}:text='Licensed intraday features appear only when available.':fontcolor=#9aa9a3:fontsize=${small_size}:x=(w-text_w)/2:y=${centre_y}+255:enable='between(t,17.2,21.5)',
      drawtext=fontfile=${FONT_BOLD}:text='CLEAR CONTEXT.':fontcolor=white:fontsize=${title_size}:x=(w-text_w)/2:y=${centre_y}-65:enable='between(t,22.0,27.0)',
      drawtext=fontfile=${FONT_BOLD}:text='NO FALSE CERTAINTY.':fontcolor=#28f6a7:fontsize=${title_size}:x=(w-text_w)/2:y=${centre_y}+45:enable='between(t,22.5,27.0)',
      drawtext=fontfile=${FONT_BOLD}:text='FIND YOUR BULLSEYE':fontcolor=white:fontsize=${title_size}:x=(w-text_w)/2:y=${centre_y}-115:enable='between(t,27.4,33.7)',
      drawtext=fontfile=${FONT_REGULAR}:text='Founding member launch':fontcolor=#28f6a7:fontsize=${body_size}:x=(w-text_w)/2:y=${centre_y}+5:enable='between(t,28.1,33.7)',
      drawtext=fontfile=${FONT_REGULAR}:text='NashAIMarkets.com':fontcolor=#9aa9a3:fontsize=${body_size}:x=(w-text_w)/2:y=${centre_y}+100:enable='between(t,28.8,33.7)',
      drawtext=fontfile=${FONT_REGULAR}:text='Educational market context only. Not financial advice.':fontcolor=#71807a:fontsize=${small_size}:x=(w-text_w)/2:y=h-65:enable='between(t,27.4,33.7)',
      fade=t=in:st=0:d=0.35,fade=t=out:st=33.4:d=0.6
    " \
    -af "volume=0.025,afade=t=in:st=0:d=1,afade=t=out:st=32:d=2" \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart \
    -c:a aac -b:a 128k -shortest "$output"
}

render_video "1920x1080" "$OUTPUT_DIR/bullseye-launch-16x9.mp4"
render_video "1080x1920" "$OUTPUT_DIR/bullseye-launch-9x16.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 29 -i "$OUTPUT_DIR/bullseye-launch-16x9.mp4" -frames:v 1 "$OUTPUT_DIR/bullseye-launch-poster.jpg"
