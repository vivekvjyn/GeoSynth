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
from models import Generator

app = Flask(__name__)

BASE_DIR = os.path.dirname(__file__)

with open(f'{BASE_DIR}/models/configs/generator.json') as f:
    gen_cfg = json.load(f)

generator = Generator(**gen_cfg)
generator.load_weights(f'{BASE_DIR}/models/weights/generator.h5')

SAMPLE_RATE = 44100


@app.route('/')
def index():
    return render_template('index.html')


@app.post('/api/stream')
def api_stream():
    data = request.json
    lat = float(data['lat'])
    lng = float(data['lng'])

    geotag = np.array([[lat / 90.0, lng / 180.0]], dtype=np.float32)
    noise = np.random.randn(1, gen_cfg['latent_dim']).astype(np.float32)
    inp = np.concatenate([geotag, noise], axis=1)

    y = generator.predict(inp, verbose=0)
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
