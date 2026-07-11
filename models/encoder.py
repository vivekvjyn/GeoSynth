from tensorflow.keras import layers, models


class Encoder(models.Model):
    def __init__(self, dense_units, activations, latent_dim, input_dim, **kwargs):
        super().__init__(**kwargs)
        self.dense_layers = [
            layers.Dense(u, activation=a)
            for u, a in zip(dense_units, activations)
        ]
        self.latent = layers.Dense(latent_dim)
        self.build(input_shape=(None, input_dim))

    def call(self, x):
        for layer in self.dense_layers:
            x = layer(x)
        return self.latent(x)

    def get_config(self):
        return super().get_config()
