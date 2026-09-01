# Separate rhythm, score rendering, and playback

Use a framework-independent rhythm model as the source of truth, project it to MusicXML 4.0 for OpenSheetMusicDisplay to render, and schedule audio independently with the Web Audio API. This separation preserves precise playback and future time-signature extensibility without treating OSMD's SVG or work-in-progress audio support as domain data or a timing source.

## Consequences

Every rhythm event must map explicitly to its MusicXML/OSMD cursor position and scheduled audio time. Rests advance both clocks without sound, while the continuation of a tied snare event advances time and the cursor without triggering another hit.
