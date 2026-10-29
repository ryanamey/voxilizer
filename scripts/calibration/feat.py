"""Measure CVT-style voice features in mono 16-bit WAV files.

Used to calibrate the synth modes (packages/engine/src/constants.ts) against the CVT Sound Library.
Usage: python3 feat.py file1.wav file2.wav ...
Decode the mp3s first, e.g. ffmpeg -i "CVT M 097.mp3" -ac 1 -ar 44100 m097.wav
Prints medians over voiced frames: f0, H1-H2 (dB), tilt (1-5 kHz vs 0-1 kHz, dB),
ring (2.5-3.6 kHz share, dB), HNR proxy (dB), subharmonic at f0/2 relative to f0 (dB).
Compare spectral shape only: the CVT recordings' loudness is equalised.
"""
import sys, numpy as np, wave, glob, os
def load(p):
    w=wave.open(p); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float)/32768; return x,w.getframerate()
def frames(x,sr,win=0.046,hop=0.02):
    n=int(win*sr);h=int(hop*sr)
    for i in range(0,len(x)-n,h): yield x[i:i+n]
def f0_of(fr,sr):
    fr=fr-fr.mean(); a=np.correlate(fr,fr,'full')[len(fr)-1:]
    if a[0]<=0: return 0,0
    a=a/a[0]; lo=int(sr/1100); hi=int(sr/70)
    k=lo+np.argmax(a[lo:hi]); return sr/k, a[k]
def feats(x,sr):
    rms=np.array([np.sqrt(np.mean(f**2)) for f in frames(x,sr)])
    thr=rms.max()*0.25; out=[]
    for f,r in zip(frames(x,sr),rms):
        if r<thr: continue
        f0,c=f0_of(f,sr)
        if c<0.5 or f0<70: continue
        W=np.hanning(len(f)); S=np.abs(np.fft.rfft(f*W,8192)); fr=np.fft.rfftfreq(8192,1/sr)
        def band(a,b): return np.sum(S[(fr>=a)&(fr<b)]**2)+1e-12
        def harm(k):
            m=(fr>k*f0*0.9)&(fr<k*f0*1.1); return S[m].max() if m.any() else 1e-9
        out.append([f0, 20*np.log10(harm(1)/harm(2)), 10*np.log10(band(1000,5000)/band(0,1000)),
                    10*np.log10(band(2500,3600)/band(0,5000)), 10*np.log10(c/(1-c+1e-6)),
                    20*np.log10(max(1e-9,S[(fr>f0*0.45)&(fr<f0*0.55)].max())/harm(1))])
    o=np.array(out); return np.median(o,axis=0), len(o)
for p in sys.argv[1:]:
    x,sr=load(p); m,n=feats(x,sr)
    print(f"{os.path.basename(p)[:22]:22s} n={n:3d} f0={m[0]:6.1f} H1-H2={m[1]:5.1f} tilt(1-5k/0-1k)={m[2]:6.1f} ring={m[3]:6.1f} HNR={m[4]:5.1f} sub={m[5]:6.1f}")
