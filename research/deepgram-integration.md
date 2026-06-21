# Deepgram Integration Plan

## Goal

Use Deepgram as the speech layer for the app:

```text
MP4 or YouTube/permitted audio
  -> audio extraction
  -> Deepgram transcription
  -> timestamped utterances with speakers
  -> LLM-generated IBIS map
  -> editable evidence-linked graph
```

Deepgram should be fundamental to the product. The map should not just be based on plain text. Every node should preserve the original voice evidence: speaker, quote, timestamp, confidence, and replayable span.

## Sources

- Deepgram prerecorded audio: https://developers.deepgram.com/docs/pre-recorded-audio
- Diarization: https://developers.deepgram.com/docs/diarization
- Utterances: https://developers.deepgram.com/docs/utterances
- Audio Intelligence: https://developers.deepgram.com/docs/audio-intelligence
- Supported formats: https://developers.deepgram.com/docs/supported-audio-formats
- Flux quickstart: https://developers.deepgram.com/docs/flux/quickstart
- Workshop repo: https://github.com/deepgram-devs/uc-berkeley-ai-workshop-2026/tree/python

## Install

```bash
pip install deepgram-sdk python-dotenv yt-dlp
brew install ffmpeg
```

Environment:

```bash
DEEPGRAM_API_KEY=...
ANTHROPIC_API_KEY=...
```

## Recommended API Usage

Use prerecorded transcription first. Live voice is a stretch feature.

Options to enable:

```text
model=nova-3
smart_format=true
utterances=true
diarize_model=latest
summarize=v2
topics=true
intents=true
sentiment=true
```

Important notes:

- Prefer `diarize_model="latest"` over older diarization flags.
- `utterances=true` gives semantically useful chunks with `start`, `end`, `transcript`, words, and speaker data.
- Deepgram can handle many formats, but for hackathon reliability extract audio from MP4 first.
- Save the response immediately. Do not assume transcripts can be retrieved later.

## MP4 and YouTube

For MP4:

```bash
ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 output.wav
```

For YouTube, only process videos the user owns or is permitted to process. The safest fallback is to let users upload MP4/audio or paste a transcript. If using a download workflow during a demo, be explicit about rights.

```bash
yt-dlp -x --audio-format mp3 -o "%(id)s.%(ext)s" "https://www.youtube.com/watch?v=..."
```

## Normalized Transcript Schema

```json
{
  "type": "normalized_transcript",
  "version": 1,
  "source": {
    "kind": "mp4|youtube|url|live",
    "original_url": "",
    "duration_seconds": 0,
    "deepgram_request_id": ""
  },
  "summary": "",
  "utterances": [
    {
      "id": "u1",
      "speaker": "speaker_0",
      "speaker_confidence": 0.82,
      "start": 0.42,
      "end": 5.43,
      "confidence": 0.88,
      "text": "Restricting cars downtown gives people cleaner air.",
      "words": []
    }
  ],
  "full_text": "Speaker 0: ..."
}
```

The LLM extractor should consume `utterances`, not only `full_text`.

## Creative Voice Features

1. **Audio-synced argument playback**
   - Clicking a map node plays the exact original audio span.
   - The graph highlights the node and related edges while audio plays.

2. **Speaker lens**
   - Filter map by speaker.
   - Show which questions, positions, pros, and cons each speaker contributed.

3. **Speak-to-map navigation**
   - User asks: "show me the objections" or "where did they decide?"
   - Deepgram live voice or browser mic transcribes the command.
   - App highlights matching nodes.

4. **Spoken judge walkthrough**
   - Generate a short narrated explanation of the final IBIS map.
   - Use this in the demo to show voice remains present after transcription.

## Prize Narrative

Deepgram is not just used for transcription. It is the perceptual foundation of the product:

- who spoke
- when they spoke
- what they said
- how confident the transcript is
- which exact speech span grounds each graph node

Voice is fundamental because the final map is an indexed, replayable reasoning structure over speech.

## Implementation Steps

1. Add a backend route `/api/transcribe`.
2. Accept uploaded MP4/audio.
3. Extract audio with `ffmpeg`.
4. Call Deepgram prerecorded transcription.
5. Normalize to `normalized_transcript`.
6. Add `/api/extract-ibis`.
7. Require every IBIS node to cite utterance IDs and timestamps.
8. Add UI for speaker rename and low-confidence transcript flags.
9. Add node click to replay source audio span.
10. Add optional voice command mode as a stretch.

