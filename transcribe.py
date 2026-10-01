"""Local speech recognition. Audio never leaves this process."""
import argparse
import json
import sys
from pathlib import Path

def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

def main():
    from faster_whisper import WhisperModel
    parser = argparse.ArgumentParser()
    parser.add_argument('--models', required=True)
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--input')
    parser.add_argument('--language', default='auto')
    args = parser.parse_args()
    model = WhisperModel('base', device='cpu', compute_type='int8', download_root=args.models,
                         local_files_only=not args.prepare)
    if args.prepare:
        emit({'type': 'ready'})
        return
    segments, info = model.transcribe(args.input, language=None if args.language == 'auto' else args.language,
                                      beam_size=5, vad_filter=True)
    result = []
    for segment in segments:
        result.append({'start': segment.start, 'end': segment.end, 'text': segment.text.strip()})
        emit({'type': 'progress', 'percent': min(99, round(segment.end / max(info.duration, 1) * 100))})
    emit({'type': 'result', 'language': info.language, 'segments': result})

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        emit({'type': 'error', 'message': str(exc)})
        sys.exit(1)
