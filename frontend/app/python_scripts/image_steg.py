from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/encode", methods=["POST"])
def encode():
    data = request.json.get("text")
    result = data[::-1]  # just an example
    return jsonify({"encoded": result})

@app.route("/decode", methods=["POST"])
def decode():
    data = request.json.get("text")
    result = data[::-1]  # decode example
    return jsonify({"decoded": result})

if __name__ == "__main__":
    app.run(port=5000, debug=True)
