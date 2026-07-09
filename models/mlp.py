import tensorflow as tf
from tensorflow.keras import layers, models


class MLP(models.Model):
    def __init__(self, dense_units, activations, **kwargs):
        super().__init__(**kwargs)
        self.dense_layers = [
            layers.Dense(u, activation=a)
            for u, a in zip(dense_units, activations)
        ]

    def call(self, x):
        for layer in self.dense_layers:
            x = layer(x)
        return x

    def get_config(self):
        return super().get_config()
