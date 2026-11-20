"""Give phrases without a recording a computer-generated pronunciation, and keep it only if it's understandable.

    uv run --python 3.12 --with torch --with transformers --with scipy --with soundfile \
        scripts/generate-audio.py [--only id,id] [--regenerate]

For each phrase it synthesises several takes with Meta's MMS Kapampangan voice (facebook/mms-tts-pam), transcribes
each with Meta's separate MMS speech recogniser (facebook/mms-1b-all, Kapampangan adapter), and keeps the take the
recogniser understands best. If no take gets close enough to the written phrase (character error rate above
MAX_CER, roughly the recogniser's own error rate on native speakers), the phrase gets no audio: a wrong
pronunciation is worse than none for beginners. Those phrases are listed as needing a human recording.

Native recordings (audioSource "native") are never touched. Generated audio is marked audioSource "generated".
Both models are CC BY-NC 4.0, so they're fine for this free, non-commercial app. Replace them before any paid use.
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
import scipy.io.wavfile
import torch
from transformers import AutoProcessor, AutoTokenizer, VitsModel, Wav2Vec2ForCTC

ROOT = Path(__file__).resolve().parent.parent
COURSE = ROOT / 'content' / 'course.json'
AUDIO = ROOT / 'public' / 'audio'
CREDIT = 'Computer voice: Meta MMS Kapampangan (facebook/mms-tts-pam, CC BY-NC 4.0)'
MAX_CER = 0.35
GOOD_ENOUGH = 0.1  # stop trying more takes once one is this clear
TAKES = [(noise, rate, seed) for noise, rate in [(0.667, 0.85), (0.333, 0.85), (0.333, 0.7), (0.667, 0.7)] for seed in range(4)]

args = sys.argv[1:]
only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
regenerate = '--regenerate' in args

course = json.loads(COURSE.read_text())
items = [i for u in course['units'] for l in u['lessons'] for i in l['items']]
todo = [i for i in items
        if i.get('audioSource') != 'native'
        and (only is None or i['id'] in only)
        and (regenerate or not i.get('audio'))]
print(f'{len(todo)} phrase(s) to voice', flush=True)
if not todo:
    sys.exit(0)

tok = AutoTokenizer.from_pretrained('facebook/mms-tts-pam')
tts = VitsModel.from_pretrained('facebook/mms-tts-pam').eval()
proc = AutoProcessor.from_pretrained('facebook/mms-1b-all')
asr = Wav2Vec2ForCTC.from_pretrained('facebook/mms-1b-all').eval()
proc.tokenizer.set_target_lang('pam')
asr.load_adapter('pam')
SR = tts.config.sampling_rate  # 16 kHz, same as the recogniser

norm = lambda s: re.sub(r'[^a-z ]', '', s.lower().replace('-', ' ')).strip()

def cer(ref, hyp):
    d = list(range(len(hyp) + 1))
    for i in range(1, len(ref) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(hyp) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (ref[i - 1] != hyp[j - 1]))
    return d[len(hyp)] / max(1, len(ref))

def synth(text, noise, rate, seed):
    tts.noise_scale, tts.speaking_rate = noise, rate
    torch.manual_seed(seed)
    with torch.no_grad():
        return tts(**tok(text, return_tensors='pt')).waveform[0].numpy()

def hear(wave):
    with torch.no_grad():
        return proc.decode(asr(**proc(wave, sampling_rate=SR, return_tensors='pt')).logits[0].argmax(-1))

AUDIO.mkdir(parents=True, exist_ok=True)
voiced, unvoiced = 0, []
for n, item in enumerate(todo, 1):
    text = item['roman'].replace('-', ' ')
    best = None
    for take in TAKES:
        wave = synth(text, *take)
        heard = hear(wave)
        score = cer(norm(text), norm(heard))
        if best is None or score < best[0]:
            best = (score, heard, wave)
        if score <= GOOD_ENOUGH:
            break
    score, heard, wave = best
    for old in AUDIO.glob(f"{item['id']}.*"):
        old.unlink()
    if score > MAX_CER:
        for k in ('audio', 'audioSource', 'audioCredit'):
            item.pop(k, None)
        unvoiced.append(item)
        print(f'[{n}/{len(todo)}] ✗ {item["roman"]!r}: best take heard as {heard!r} (CER {score:.2f}), left without audio', flush=True)
        continue
    wave = wave / max(1e-6, float(np.abs(wave).max())) * 0.9
    pad = np.zeros(int(0.15 * SR), dtype=np.float32)
    wave = np.concatenate([pad, wave.astype(np.float32), pad])
    with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
        scipy.io.wavfile.write(wav.name, SR, (wave * 32767).astype(np.int16))
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', wav.name, str(AUDIO / f"{item['id']}.m4a")], check=True)
    item['audio'] = f"audio/{item['id']}.m4a"
    item['audioSource'] = 'generated'
    item['audioCredit'] = CREDIT
    voiced += 1
    print(f'[{n}/{len(todo)}] ✓ {item["roman"]!r} heard as {heard!r} (CER {score:.2f})', flush=True)
    if n % 20 == 0:
        COURSE.write_text(json.dumps(course, ensure_ascii=False, indent=2) + '\n')  # checkpoint

COURSE.write_text(json.dumps(course, ensure_ascii=False, indent=2) + '\n')
print(f'\nvoiced {voiced}, left for a human recording {len(unvoiced)}:')
for i in unvoiced:
    print(f"  {i['id']}: {i['roman']}")
