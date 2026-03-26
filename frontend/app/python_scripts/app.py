from flask import Flask, request, jsonify
import subprocess, sys, os

app = Flask(__name__)

@app.route("/encode-audio", methods=["POST"])
def encode_audio():
    path = request.json["path"]
    secret = request.json["secret"]
    # call your audio_steg.py
    result = subprocess.run(
        [sys.executable, "audio_steg.py", "encode", path],
        input=secret.encode(),
        cwd=os.path.dirname(__file__),
        capture_output=True,
    )
    return jsonify({"output": result.stdout.decode()})

if __name__ == "__main__":
    app.run(port=5000, debug=True)
