import json
from .mlp import MLP
from .decoder import Decoder

BASE_DIR = __import__('os').path.dirname(__file__)

with open(f'{BASE_DIR}/configs/mlp.json') as f:
    mlp_cfg = json.load(f)
with open(f'{BASE_DIR}/configs/decoder.json') as f:
    dec_cfg = json.load(f)

mlp = MLP(**mlp_cfg)
mlp.build(input_shape=(None, 2))
mlp.load_weights(f'{BASE_DIR}/weights/mlp.h5')

decoder = Decoder(**dec_cfg)
decoder.build(input_shape=(None, 64))
decoder.load_weights(f'{BASE_DIR}/weights/decoder.h5')
