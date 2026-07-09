import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['CUDA_VISIBLE_DEVICES'] = ''

import warnings
warnings.filterwarnings('ignore')

import logging
logging.getLogger('tensorflow').setLevel(logging.ERROR)

import struct
import json
import numpy as np
from flask import Flask, request, jsonify, render_template, Response
from models.mlp import MLP
from models.decoder import Decoder
from utils import haversine_distance
import geocoder

app = Flask(__name__)

SAMPLE_RATE = 44100

with open('models/configs/mlp.json') as f:
    mlp_cfg = json.load(f)
with open('models/configs/decoder.json') as f:
    dec_cfg = json.load(f)

mlp = MLP(**mlp_cfg)
mlp.build(input_shape=(None, 2))
mlp.load_weights('models/weights/mlp.h5')

decoder = Decoder(**dec_cfg)
decoder.build(input_shape=(None, 64))
decoder.load_weights('models/weights/decoder.h5')


@app.route('/')
def index():
    return render_template('index.html')


@app.post('/api/chunk')
def api_chunk():
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


@app.post('/api/resolve')
def api_resolve():
    data = request.json
    country = data.get('country', '')
    g = geocoder.arcgis(country)
    lat, lng = g.latlng
    return jsonify({'lat': lat, 'lng': lng})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
