import sys, os, wave

MARKER = "*^*^*"

def encode(path, secret):
    song = wave.open(path, mode='rb')
    nframes = song.getnframes()
    frames = song.readframes(nframes)
    frame_bytes = bytearray(frames)

    data = (secret + MARKER).encode("utf-8")
    bits = []
    for c in data:
        bits.extend([ (c>>i)&1 for i in range(7,-1,-1) ])

    if len(bits) > len(frame_bytes):
        raise SystemExit("Insufficient capacity")

    for i, bit in enumerate(bits):
        frame_bytes[i] = (frame_bytes[i] & 254) | bit

    out = os.path.splitext(path)[0] + "-stego.wav"
    with wave.open(out, 'wb') as outw:
        outw.setparams(song.getparams())
        outw.writeframes(bytes(frame_bytes))
    song.close()
    print(out)

def decode(path):
    song = wave.open(path, mode='rb')
    nframes = song.getnframes()
    frames = song.readframes(nframes)
    frame_bytes = bytearray(frames)

    bits = [ b & 1 for b in frame_bytes ]
    chars = []
    for i in range(0, len(bits), 8):
        byte = bits[i:i+8]
        if len(byte) < 8: break
        val = 0
        for b in byte:
            val = (val<<1) | b
        chars.append(chr(val))
        if "".join(chars).endswith(MARKER):
            print("".join(chars)[:-len(MARKER)])
            song.close()
            return
    print("")
    song.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: audio_steg.py [encode|decode] <path>", file=sys.stderr); sys.exit(2)
    op, path = sys.argv[1], sys.argv[2]
    if op == "encode":
        secret = sys.stdin.read()
        encode(path, secret.strip())
    elif op == "decode":
        decode(path)
    else:
        sys.exit(2)
