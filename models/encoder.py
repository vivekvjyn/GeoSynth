import tensorflow as tf
from tensorflow.keras import layers, models


class Encoder(models.Model):
    def __init__(self, conv_configs, dense_units, activations, latent_dim, **kwargs):
        super().__init__(**kwargs)
        self.conv_layers = []
        for cfg in conv_configs:
            self.conv_layers.append(layers.Conv1D(cfg['filters'], cfg['kernel_size'],
                                                   activation=cfg.get('activation', 'relu')))
            if cfg.get('pool_size'):
                self.conv_layers.append(layers.MaxPooling1D(cfg['pool_size']))
        self.flatten = layers.Flatten()
        self.dense_layers = [
            layers.Dense(u, activation=a)
            for u, a in zip(dense_units, activations)
        ]
        self.output_layer = layers.Dense(latent_dim, activation='tanh')

    def call(self, x):
        x = layers.Reshape((x.shape[-1], 1))(x)
        for layer in self.conv_layers:
            x = layer(x)
        x = self.flatten(x)
        for layer in self.dense_layers:
            x = layer(x)
        return self.output_layer(x)

    def get_config(self):
        return super().get_config()
