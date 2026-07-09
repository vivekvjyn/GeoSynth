# GeoSynth

Real-time geographic audio synthesis. Click countries on a 3D globe to build a route, and the app generates audio from neural networks trained on geographic coordinates.

## Run locally

```bash
conda create -n geosynth python=3.10 && conda activate geosynth
pip install -r requirements.txt
python app.py
```

## Deploy (Render)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. **Build Command**: `pip install -r requirements.txt`
5. **Start Command**: `gunicorn app:app --timeout 120`
6. Deploy

The app sleeps after 15min idle. First request wakes it (~50s), then it runs normally.
