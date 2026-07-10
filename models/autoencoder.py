from tensorflow.keras import layers, models
from .encoder import Encoder
from .decoder import Decoder


class AutoEncoder(models.Model):
    def __init__(self, encoder_cfg, decoder_cfg, **kwargs):
        super().__init__(**kwargs)
        self.encoder = Encoder(**encoder_cfg)
        self.decoder = Decoder(**decoder_cfg)
        self.build(input_shape=(None, encoder_cfg['input_dim']))

    def call(self, x):
        z = self.encoder(x)
        return self.decoder(z)
