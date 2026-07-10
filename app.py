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
from models import MLP, Decoder

app = Flask(__name__)

BASE_DIR = os.path.dirname(__file__)

with open(f'{BASE_DIR}/models/configs/mlp.json') as f:
    mlp_cfg = json.load(f)
with open(f'{BASE_DIR}/models/configs/decoder.json') as f:
    dec_cfg = json.load(f)

mlp = MLP(**mlp_cfg)
mlp.load_weights(f'{BASE_DIR}/models/weights/mlp.h5')

decoder = Decoder(**dec_cfg)
decoder.load_weights(f'{BASE_DIR}/models/weights/decoder.h5')

SAMPLE_RATE = 44100


@app.route('/')
def index():
    return render_template('index.html')


@app.post('/api/stream')
def api_stream():
    data = request.json
    lat = float(data['lat'])
    lng = float(data['lng'])

    X = np.array([[lat / 90.0, lng / 180.0]], dtype=np.float32)
    latent = mlp.predict(X, verbose=0)
    y = decoder.predict(latent, verbose=0)
    y = np.nan_to_num(y, nan=0.0, posinf=1.0, neginf=-1.0)
    y = np.clip(y, -1.0, 1.0).astype(np.float32)
    flat = y.flatten()

    return Response(
        flat.tobytes(),
        mimetype='application/octet-stream',
        headers={
            'X-Sample-Count': str(len(flat)),
            'X-Sample-Rate': str(SAMPLE_RATE),
            'Cache-Control': 'no-cache'
        }
    )


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
