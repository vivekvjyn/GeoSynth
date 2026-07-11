import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['CUDA_VISIBLE_DEVICES'] = ''

import warnings
warnings.filterwarnings('ignore')

import logging
logging.getLogger('tensorflow').setLevel(logging.ERROR)

import json
import numpy as np
from flask import Flask, request, render_template, Response
from huggingface_hub import hf_hub_download
from models import MLP, Decoder

app = Flask(__name__)

hf_repo = "vivekvjyn/GeoSynth"

def load_cfg(name):
    path = hf_hub_download(repo_id=hf_repo, filename=name)
    with open(path) as f:
        return json.load(f)

mlp = MLP(**load_cfg("mlp.json"))
decoder = Decoder(**load_cfg("decoder.json"))

mlp.load_weights(hf_hub_download(repo_id=hf_repo, filename="mlp.h5"))
decoder.load_weights(hf_hub_download(repo_id=hf_repo, filename="decoder.h5"))

sample_rate = 44100


@app.route('/')
def index():
    return render_template('index.html')


@app.post('/api/stream')
def api_stream():
    data = request.json
    lat = float(data['lat'])
    lng = float(data['lng'])

    geotag = np.array([[lat / 90.0, lng / 180.0]], dtype=np.float32)
    latent = mlp.predict(geotag, verbose=0)
    y = decoder.predict(latent, verbose=0)

    y = np.nan_to_num(y, nan=0.0, posinf=1.0, neginf=-1.0)
    y = np.clip(y, -1.0, 1.0).astype(np.float32)
    flat = y.flatten()

    return Response(
        flat.tobytes(),
        mimetype='application/octet-stream',
        headers={
            'X-Sample-Count': str(len(flat)),
            'X-Sample-Rate': str(sample_rate),
            'Cache-Control': 'no-cache'
        }
    )


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
