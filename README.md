# For Ash, Always

A single-page birthday experience built with plain HTML, CSS and JavaScript. No backend, tracking, or dependencies beyond Google Fonts (with system fallbacks).

## Run locally
Open `index.html` in a browser. For microphone access, browsers require a secure context: use HTTPS when deployed, or `localhost` during local development.

## Publish
Upload the whole folder to GitHub Pages, Netlify, or another static host. Keep the `assets` folder beside `index.html`.

## Original soundtrack
The original soundtrack from the reference site (https://patrick-paul.github.io/happybirthday/) is bundled at `assets/hbd.mpeg` and wired to the player in `index.html`. Do not replace it with a different song if you want to preserve the original.

## Personalize
Edit the text directly in `index.html`. The name and age appear in the welcome and birthday scenes. The final letter is editable in the `.letter-note` section.

## Microphone candle interaction
The microphone is requested only after the visitor taps **Enable microphone**. Audio is analyzed locally in the browser to detect a sustained loud breath-like burst; no audio is recorded or uploaded. Microphone tracks are stopped when the candles are extinguished or the page is closed. If permission is denied or sensing is unreliable, use **Or tap here to blow them out**.
