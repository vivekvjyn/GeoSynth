import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import warnings
warnings.filterwarnings('ignore')

import logging
logging.getLogger('tensorflow').setLevel(logging.ERROR)

import io
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, render_template, send_file
from models.vae import MLP, Decoder, CHUNK_SIZE
import geocoder
import soundfile as sf
from scipy.interpolate import interp1d

app = Flask(__name__)

LATENT_DIM = 64
SAMPLE_RATE = 44100

mlp = MLP(latent_dim=LATENT_DIM)
mlp.build(input_shape=(None, 2))
mlp.load_weights('models/weights/mlp.h5')

decoder = Decoder(latent_dim=LATENT_DIM)
decoder.build(input_shape=(None, LATENT_DIM))
decoder.load_weights('models/weights/decoder.h5')


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2) ** 2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2) ** 2
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


def process_coordinates(lat_start, lng_start, lat_end, lng_end, num_points=100):
    lats = np.linspace(lat_start, lat_end, num_points)
    longs = np.linspace(lng_start, lng_end, num_points)
    df = pd.DataFrame({'Latitude': lats, 'Longitude': longs})
    df['Latitude'] = df['Latitude'] / 90.0
    df['Longitude'] = df['Longitude'] / 180.0
    return df.to_numpy()


def predict_latent_and_output(X):
    latent = mlp.predict(X, verbose=0)
    y = decoder.predict(latent, verbose=0)
    return y


def concatenate_audio(y):
    y_concat = np.concatenate(y)
    y_concat = np.nan_to_num(y_concat, nan=0.0, posinf=1.0, neginf=-1.0)
    return np.clip(y_concat, -1.0, 1.0)



@app.route('/')
def index():
    return render_template('index.html')


@app.post('/api/generate')
def api_generate():
    data = request.json
    lat1 = float(data['lat1'])
    lng1 = float(data['lng1'])
    lat2 = float(data['lat2'])
    lng2 = float(data['lng2'])
    speed = float(data.get('speed', 40))
    volume = float(data.get('volume', 0.7))

    distance_km = haversine_distance(lat1, lng1, lat2, lng2)
    target_duration = distance_km / speed

    X = process_coordinates(lat1, lng1, lat2, lng2)
    y = predict_latent_and_output(X)
    audio = concatenate_audio(y)

    target_samples = int(target_duration * SAMPLE_RATE)
    if target_samples > 0 and target_samples != len(audio):
        x_old = np.linspace(0, 1, len(audio))
        x_new = np.linspace(0, 1, target_samples)
        f = interp1d(x_old, audio, kind='linear')
        audio = f(x_new)

    audio = np.clip(audio * volume, -1.0, 1.0)

    buf = io.BytesIO()
    sf.write(buf, audio, SAMPLE_RATE, format='WAV', subtype='PCM_16')
    buf.seek(0)

    return send_file(buf, mimetype='audio/wav', download_name='output.wav')


@app.post('/api/resolve')
def api_resolve():
    data = request.json
    country = data.get('country', '')
    g = geocoder.arcgis(country)
    lat, lng = g.latlng
    return jsonify({'lat': lat, 'lng': lng})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
