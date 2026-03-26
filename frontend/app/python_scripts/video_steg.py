import sys, os, cv2, numpy as np

MARKER = "*^*^*"

def msgtobinary(msg):
    return ''.join([format(ord(i), '08b') for i in msg])

def rc4keystream(key, n):
    S = list(range(256)); j = 0
    key = [ord(c) for c in key] if key else [0]
    for i in range(256):
        j = (j + S[i] + key[i % len(key)]) % 256
        S[i], S[j] = S[j], S[i]
    i = j = 0; out = []
    for _ in range(n):
        i = (i+1) % 256
        j = (j+S[i]) % 256
        S[i], S[j] = S[j], S[i]
        out.append(S[(S[i]+S[j]) % 256])
    return out

def encode(video_path, frame_index, secret, key=""):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened(): raise SystemExit("Cannot open video")
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_index = max(1, min(frame_index, total))
    width  = int(cap.get(3)); height = int(cap.get(4))
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    outpath = os.path.splitext(video_path)[0] + "-stego.mp4"
    out = cv2.VideoWriter(outpath, fourcc, cap.get(5) or 25.0, (width, height))

    payload = secret + MARKER
    if key:
        ks = rc4keystream(key, len(payload))
        payload = "".join([ chr(ord(payload[i]) ^ ks[i]) for i in range(len(payload)) ])

    binary = msgtobinary(payload)
    idx = 0; L = len(binary)
    n = 0

    while True:
        ret, frame = cap.read()
        if not ret: break
        n += 1
        if n == frame_index:
            for row in frame:
                for pixel in row:
                    r,g,b = [format(p, "08b") for p in pixel]
                    if idx < L: pixel[0] = int(r[:-1] + binary[idx], 2); idx += 1
                    if idx < L: pixel[1] = int(g[:-1] + binary[idx], 2); idx += 1
                    if idx < L: pixel[2] = int(b[:-1] + binary[idx], 2); idx += 1
                    if idx >= L: break
                if idx >= L: break
        out.write(frame)

    cap.release(); out.release()
    print(outpath)

def decode(video_path, frame_index, key=""):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened(): raise SystemExit("Cannot open video")
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_index = max(1, min(frame_index, total))
    n = 0
    while True:
        ret, frame = cap.read()
        if not ret: break
        n += 1
        if n == frame_index:
            data_bin = ""
            for row in frame:
                for pixel in row:
                    r,g,b = [format(p, "08b") for p in pixel]
                    data_bin += r[-1] + g[-1] + b[-1]
                    bytes_ = [data_bin[i:i+8] for i in range(0, len(data_bin), 8)]
                    s = ""
                    for bt in bytes_:
                        if len(bt) < 8: break
                        s += chr(int(bt, 2))
                        if s.endswith(MARKER):
                            msg = s[:-len(MARKER)]
                            if key:
                                ks = rc4keystream(key, len(msg))
                                msg = "".join([ chr(ord(msg[i]) ^ ks[i]) for i in range(len(msg)) ])
                            print(msg)
                            cap.release()
                            return
            print("")
            cap.release()
            return

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("usage: video_steg.py encode <path> <frameIndex> [key]  |  video_steg.py decode <path> <frameIndex> [key]", file=sys.stderr); sys.exit(2)
    op = sys.argv[1]
    path = sys.argv[2]
    frame = int(sys.argv[3])
    key = sys.argv[4] if len(sys.argv) > 4 else ""
    if op == "encode":
        secret = sys.stdin.read()
        encode(path, frame, secret.strip(), key)
    elif op == "decode":
        decode(path, frame, key)
    else:
        sys.exit(2)
