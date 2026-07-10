from tensorflow.keras import layers, models


class Decoder(models.Model):
    def __init__(self, dense_units, activations, output_dim, latent_dim, **kwargs):
        super().__init__(**kwargs)
        self.dense_layers = [
            layers.Dense(u, activation=a)
            for u, a in zip(dense_units, activations)
        ]
        self.reshape = layers.Reshape((output_dim,))
        self.build(input_shape=(None, latent_dim))

    def call(self, x):
        for layer in self.dense_layers:
            x = layer(x)
        return self.reshape(x)

    def get_config(self):
        return super().get_config()
